import { describe, expect, test } from 'bun:test';
import { DiBag } from '../src';

describe('container derivation contracts', () => {
  test('creates empty child and independent containers with distinct ownership', async () => {
    let disposed = 0;
    const root = DiBag.createBuilder().withServices({
      value: DiBag.providerWithDisposal({ provider: () => ({}), disposeService: () => { disposed++; } }),
    }).buildContainer();
    const child = root.createChildContainer();
    const independent = root.createIndependentContainer();
    const emptyChild = root.createChildContainer({});
    const emptyIndependent = root.createIndependentContainer({});
    child.resolve('value'); independent.resolve('value');
    emptyChild.resolve('value'); emptyIndependent.resolve('value');
    await root.close();
    expect(disposed).toBe(2);
    await Promise.all([independent.close(), emptyIndependent.close()]);
    expect(disposed).toBe(4);
  });

  test('replaces selected services and shares selected parent acquisitions', async () => {
    let acquired = 0;
    const root = DiBag.createBuilder().withServices({
      shared: () => ({ id: ++acquired }),
      value: () => 1,
    }).buildContainer();
    const parentShared = root.resolve('shared');
    const child = root.createChildContainer(
      ['value'],
      { value: () => 2 },
      { sharedParentServiceKeys: ['shared'] },
    );
    expect(child.resolve('value')).toBe(2);
    expect(child.resolve('shared')).toBe(parentShared);
    await child.close(); await root.close();
  });

  test('supports token and collection-token computed provider keys', async () => {
    const key = Symbol('clock');
    const listKey = Symbol('clocks');
    const clock = DiBag.createToken(key).forService<{ now(): number }>();
    const clocks = DiBag.createToken(listKey).forCollectionOf<{ now(): number }>();
    const root = DiBag.createBuilder()
      .withTokenService(clock, () => ({ now: () => 1 }))
      .withCollectionContribution({ collectionToken: clocks, provider: () => ({ now: () => 2 }) })
      .buildContainer();
    const replacement = [{ now: () => 4 }];
    let disposed: unknown;
    const independent = root.createIndependentContainer(
      [clock, clocks],
      {
        [key]: () => ({ now: () => 3 }),
        [listKey]: DiBag.providerWithDisposal({ provider: (): readonly { now(): number }[] => replacement, disposeService: value => { disposed = value; } }),
      },
    );
    expect(independent.resolve(clock).now()).toBe(3);
    const first = independent.resolveCollection(clocks);
    const second = independent.resolveCollection(clocks);
    expect(first.map(value => value.now())).toEqual([4]);
    expect(first).not.toBe(second);
    expect(Object.isFrozen(first)).toBe(true);
    expect(replacement).not.toBe(first);
    await independent.close();
    expect(disposed).toBe(replacement);
    await root.close();
  });

  test.each([
    ['single-service', 'collection'],
    ['collection', 'single-service'],
  ] as const)('rejects a %s selection when the graph already owns the symbol as %s before reading its provider', (selectedKind, graphKind) => {
    const key = Symbol('same-key');
    const tokenFactory = DiBag.createToken(key);
    const single = tokenFactory.forService<number>();
    const collection = tokenFactory.forCollectionOf<number>();
    const root = graphKind === 'single-service'
      ? DiBag.createBuilder().withTokenService(single, () => 1).buildContainer()
      : DiBag.createBuilder().withCollectionContribution({ collectionToken: collection, provider: () => 1 }).buildContainer();
    const selected = selectedKind === 'single-service' ? single : collection;
    let providerReads = 0;
    const providers = { get [key]() { providerReads++; return () => selectedKind === 'collection' ? [2] : 2; } };
    try {
      (root.createIndependentContainer as (...args: unknown[]) => unknown)([selected], providers);
      throw new Error('expected token-kind rejection');
    } catch (error) {
      expect(error).toMatchObject({
        code: 'DI_BAG_WRONG_TOKEN_KIND',
        details: { operation: 'createIndependentContainer', expectedKind: graphKind, receivedKind: selectedKind },
      });
    }
    expect(providerReads).toBe(0);
  });

  test('claims shared token kinds after collection replacement before reading replacement providers', async () => {
    const key = Symbol('shared-kind');
    const factory = DiBag.createToken(key);
    const single = factory.forService<number>();
    const collection = factory.forCollectionOf<number>();
    const root = DiBag.createBuilder()
      .withCollectionContribution({ collectionToken: collection, provider: () => 1 })
      .withServices({ value: () => 1 })
      .buildContainer();
    const replaced = root.createIndependentContainer([collection], { [key]: () => [2] });
    let providerReads = 0;
    try {
      (replaced.createChildContainer as (...args: unknown[]) => unknown)(
        ['value'],
        { get value() { providerReads++; return () => 2; } },
        { sharedParentServiceKeys: [single] },
      );
      throw new Error('expected token-kind rejection');
    } catch (error) {
      expect(error).toMatchObject({
        code: 'DI_BAG_WRONG_TOKEN_KIND',
        details: { operation: 'createChildContainer', expectedKind: 'collection', receivedKind: 'single-service' },
      });
    }
    expect(providerReads).toBe(0);
    await replaced.close(); await root.close();
  });

  test('validates explicit empty replacement maps without reading unselected values', async () => {
    const root = DiBag.createBuilder().withServices({ value: () => 1 }).buildContainer();
    for (const operation of ['createChildContainer', 'createIndependentContainer'] as const) {
      for (const replacementProviders of [null, [], 1, () => 1]) {
        try {
          (root[operation] as (...args: unknown[]) => unknown)([], replacementProviders);
          throw new Error('expected replacement provider map rejection');
        } catch (error) {
          expect(error).toMatchObject({
            code: 'DI_BAG_INVALID_ARGUMENT',
            details: { operation, argument: 'replacementProviders', expected: 'an object' },
          });
        }
      }
      const providers = { get unselected(): never { throw new Error('must stay unread'); } };
      const derived = (root[operation] as (...args: unknown[]) => typeof root)([], providers);
      expect(derived.resolve('value')).toBe(1);
      await derived.close();
    }
    await root.close();
  });

  test('snapshots tuple indices before provider getters can mutate them', async () => {
    const selected = ['value'] as const;
    const root = DiBag.createBuilder().withServices({ value: () => 1 }).buildContainer();
    const independent = root.createIndependentContainer(
      selected,
      { get value() { (selected as unknown as string[])[0] = 'missing'; return () => 2; } },
    );
    expect(independent.resolve('value')).toBe(2);
    await independent.close(); await root.close();
  });

  test('reads every allowed option and provider property exactly once', async () => {
    const reads = { sharedParentServiceKeys: 0, value: 0 };
    const providers = { get value() { reads.value++; return () => 2; } };
    const sharing = {
      get sharedParentServiceKeys() { reads.sharedParentServiceKeys++; return ['shared'] as const; },
    };
    const root = DiBag.createBuilder().withServices({ value: () => 1, shared: () => 3 }).buildContainer();
    const child = root.createChildContainer(['value'], providers, sharing);
    expect(child.resolve('value')).toBe(2);
    expect(reads).toEqual({ sharedParentServiceKeys: 1, value: 1 });
    await child.close(); await root.close();
  });

  test.each(['createChildContainer', 'createIndependentContainer'] as const)('reports malformed replacement providers for %s', operation => {
    const root = DiBag.createBuilder().withServices({ value: () => 1 }).buildContainer();
    try {
      (root[operation] as (...args: unknown[]) => unknown)(['value'], { value: 1 });
      throw new Error('expected malformed provider rejection');
    } catch (error) {
      expect(error).toMatchObject({ code: 'DI_BAG_INVALID_REGISTRATION', details: { operation } });
    }
  });

  test.each([
    [null, 'createIndependentContainer requires one options object'],
    [{ extra: true }, 'createIndependentContainer does not accept the option extra'],
    [{ replacedServiceKeys: ['value'] }, 'createIndependentContainer does not accept the option replacedServiceKeys'],
    [{ replacementProviders: { value: () => 2 } }, 'createIndependentContainer does not accept the option replacementProviders'],
  ] as const)('rejects malformed independent empty options %#', (options, message) => {
    const root = DiBag.createBuilder().withServices({ value: () => 1 }).buildContainer();
    expect(() => root.createIndependentContainer(options as never)).toThrow(message);
  });

  test('rejects inherited and overlapping child options before provider getters', () => {
    const root = DiBag.createBuilder().withServices({ value: () => 1 }).buildContainer();
    const inherited = Object.create({ sharedParentServiceKeys: ['value'] });
    expect(() => root.createChildContainer(inherited)).toThrow('createChildContainer reads own properties only');
    let read = false;
    expect(() => (root.createChildContainer as (...args: unknown[]) => unknown)(
      ['value'],
      { get value() { read = true; return () => 2; } },
      { sharedParentServiceKeys: ['value'] },
    )).toThrow('createChildContainer cannot share and replace the same service');
    expect(read).toBe(false);
  });

  test('positional fallback normalizes explicit undefined and replacement forms', async () => {
    const root = DiBag.createBuilder().withServices({ value: () => 1, shared: () => ({ id: 1 }) }).buildContainer();
    const parentShared = root.resolve('shared');
    const undefinedChild = root.createChildContainer(undefined);
    const undefinedIndependent = root.createIndependentContainer(undefined);
    const child = root.createChildContainer(['value'], { value: () => 2 }, undefined);
    const sharedChild = root.createChildContainer(
      ['value'],
      { value: () => 3 },
      { sharedParentServiceKeys: ['shared'] },
    );
    const independent = root.createIndependentContainer(['value'], { value: () => 4 });
    expect(child.resolve('value')).toBe(2);
    expect(sharedChild.resolve('value')).toBe(3);
    expect(sharedChild.resolve('shared')).toBe(parentShared);
    expect(independent.resolve('value')).toBe(4);
    expect(undefinedChild.resolve('value')).toBe(1);
    expect(undefinedIndependent.resolve('value')).toBe(1);
    await Promise.all([
      undefinedChild.close(), undefinedIndependent.close(), child.close(), sharedChild.close(), independent.close(), root.close(),
    ]);
  });

  test.each([
    ['createChildContainer', [[], {}, {}, {}], "one of: '0', '1', '2', '3'"],
    ['createIndependentContainer', [[], {}, {}], "one of: '0', '1', '2'"],
  ] as const)('positional fallback rejects malformed arity for %s', (operation, args, expected) => {
    const root = DiBag.createBuilder().withServices({ value: () => 1 }).buildContainer();
    try {
      (root[operation] as (...values: unknown[]) => unknown)(...args);
      throw new Error('expected arity rejection');
    } catch (error) {
      expect(error).toMatchObject({
        code: 'DI_BAG_INVALID_ARGUMENT',
        details: { operation, argument: 'arguments.length', expected },
      });
    }
  });

  test('positional fallback rejects replacement properties in one-bag forms', () => {
    const root = DiBag.createBuilder().withServices({ value: () => 1 }).buildContainer();
    for (const operation of ['createChildContainer', 'createIndependentContainer'] as const) {
      try {
        (root[operation] as (options: unknown) => unknown)({
          replacedServiceKeys: ['value'], replacementProviders: { value: () => 2 },
        });
        throw new Error('expected one-bag replacement rejection');
      } catch (error) {
        expect(error).toMatchObject({
          code: 'DI_BAG_INVALID_ARGUMENT',
          details: {
            operation,
            argument: 'options',
            expected: operation === 'createChildContainer'
              ? 'only the own properties: sharedParentServiceKeys'
              : 'only the own properties: ',
          },
        });
      }
    }
  });

  test('positional fallback rejects unknown third-bag keys with exact details', () => {
    const root = DiBag.createBuilder().withServices({ value: () => 1 }).buildContainer();
    try {
      (root.createChildContainer as (...args: unknown[]) => unknown)([], {}, { extra: true });
      throw new Error('expected third-bag rejection');
    } catch (error) {
      expect(error).toMatchObject({
        code: 'DI_BAG_INVALID_ARGUMENT',
        details: {
          operation: 'createChildContainer',
          argument: 'options',
          expected: 'only the own properties: sharedParentServiceKeys',
        },
      });
    }
  });
});
