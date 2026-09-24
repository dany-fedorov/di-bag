import { expect, test } from 'bun:test';
import { DiBag } from '../src';

test('an unmarked provider is shared by a container tree while an explicit scoped provider is per container', async () => {
  let singletonCalls = 0;
  let scopedCalls = 0;
  const root = DiBag.createBuilder().withServices({
    singleton: () => ({ call: ++singletonCalls }),
    scoped: DiBag.providerWithLifetime({ provider: () => ({ call: ++scopedCalls }), lifetime: 'scoped:one-per-container' }),
  }).buildContainer();
  const child = root.createChildContainer();
  const sibling = root.createChildContainer();

  expect(child.resolve('singleton')).toBe(root.resolve('singleton'));
  expect(sibling.resolve('singleton')).toBe(root.resolve('singleton'));
  expect(child.resolve('scoped')).not.toBe(root.resolve('scoped'));
  expect(sibling.resolve('scoped')).not.toBe(child.resolve('scoped'));
  expect(singletonCalls).toBe(1);
  expect(scopedCalls).toBe(3);
  await root.close();
});

test('a child rejects an inherited singleton before reading replacement getters', async () => {
  let reads = 0;
  const root = DiBag.createBuilder().withServices({ value: () => 1 }).buildContainer();
  const replacementProviders = Object.defineProperty({}, 'value', {
    enumerable: true,
    get() { reads++; return () => 2; },
  }) as { value: () => number };

  let failure: unknown;
  try {
    (root.createChildContainer as (...args: unknown[]) => unknown)(['value'], replacementProviders);
  } catch (error) { failure = error; }
  expect(failure).toBeInstanceOf(Error);
  expect((failure as { code: string }).code).toBe('DI_BAG_SINGLETON_REPLACEMENT');
  expect((failure as { details: object }).details).toEqual({ operation: 'createChildContainer', serviceKey: 'value' });
  expect((failure as Error).message).toContain("cannot replace singleton service 'value'; mark it 'scoped:one-per-container' or use createIndependentContainer");
  expect(reads).toBe(0);
  await root.close();
});

test('a child may replace scoped and transient services', async () => {
  const root = DiBag.createBuilder().withServices({
    scoped: DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'scoped:one-per-container' }),
    transient: DiBag.providerWithLifetime({ provider: () => 2, lifetime: 'transient:one-per-resolve' }),
  }).buildContainer();
  const child = root.createChildContainer(
    ['scoped', 'transient'],
    { scoped: () => 3, transient: () => 4 },
  );
  expect(child.resolve('scoped')).toBe(3);
  expect(child.resolve('transient')).toBe(4);
  await root.close();
});

test('an independent container may replace a singleton', async () => {
  const root = DiBag.createBuilder().withServices({ value: () => ({ source: 'root' }) }).buildContainer();
  const independent = root.createIndependentContainer(
    ['value'],
    { value: () => ({ source: 'independent' }) },
  );
  expect(independent.resolve('value')).toEqual({ source: 'independent' });
  expect(independent.resolve('value')).not.toBe(root.resolve('value'));
  await independent.close();
  await root.close();
});

test('a singleton replacement is anchored to the child that introduces it', async () => {
  const root = DiBag.createBuilder().withServices({
    value: DiBag.providerWithLifetime({ provider: () => ({ source: 'root' }), lifetime: 'scoped:one-per-container' }),
  }).buildContainer();
  const child = root.createChildContainer(
    ['value'],
    { value: () => ({ source: 'child' }) },
  );
  const grandchild = child.createChildContainer();
  expect(grandchild.resolve('value')).toBe(child.resolve('value'));
  expect(child.resolve('value')).not.toBe(root.resolve('value'));
  expect(() => (child.createChildContainer as (...args: unknown[]) => unknown)(
    ['value'], { value: () => ({ source: 'grandchild' }) },
  )).toThrow(/cannot replace singleton service 'value'/);
  await root.close();
});

test('an alias uses its target singleton lifetime for child replacement', async () => {
  const root = DiBag.createBuilder().withServices({ target: () => ({ value: 1 }) })
    .withServiceAlias({ aliasKey: 'alias', targetServiceKey: 'target' })
    .buildContainer();
  expect(() => (root.createChildContainer as (...args: unknown[]) => unknown)(
    ['alias'], { alias: () => ({ value: 2 }) },
  )).toThrow(/cannot replace singleton service 'alias'/);
  await root.close();
});

test('a collection token keeps its fresh replacement view and has no singular lifetime lookup', async () => {
  const itemsKey = Symbol('items');
  const items = DiBag.createToken(itemsKey).forCollectionOf<number>();
  const root = DiBag.createBuilder()
    .withCollectionContribution({ collectionToken: items, provider: () => 1 })
    .buildContainer();
  const child = root.createChildContainer(
    [items],
    { [items.symbol]: () => [2, 3] },
  );
  expect(child.resolveCollection(items)).toEqual([2, 3]);
  expect(child.resolveCollection(items)).not.toBe(child.resolveCollection(items));
  await child.close(); await root.close();
});

test('the documented silent gap remains: an unmarked dependency-free request value is shared', async () => {
  let next = 0;
  const root = DiBag.createBuilder().withServices({ request: () => ({ id: ++next }) }).buildContainer();
  const first = root.createChildContainer();
  const second = root.createChildContainer();
  expect(first.resolve('request')).toBe(second.resolve('request'));
  expect(next).toBe(1);
  await root.close();
});
