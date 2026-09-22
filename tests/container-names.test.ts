import { describe, expect, test } from 'bun:test';
import { DiBag } from '../src';

describe('0.5 container names', () => {
  test('reads named, token, collection, and graph snapshots without acquisition', async () => {
    const tokenKey = Symbol('token');
    const listKey = Symbol('list');
    const token = DiBag.token(tokenKey).of<number>();
    const list = DiBag.token(listKey).forCollectionOf<number>();
    const container = DiBag.createBuilder().withServices({ named: () => 1 })
      .withTokenService(token, () => 2)
      .withCollectionContribution({ collectionToken: list, provider: () => 3 })
      .buildContainer();
    expect(container.serviceSnapshot('named').acquisitions).toEqual([]);
    expect(container.serviceSnapshot(token).acquisitions).toEqual([]);
    expect(container.serviceSnapshot(list)).toHaveLength(1);
    expect(container.graphSnapshot().bindings.length).toBe(3);
    await container.close();
  });

  test('renames a module export through one options bag', async () => {
    const feature = DiBag.createBuilder().withServices({ value: () => 1 })
      .buildModule({ exportedServiceKeys: ['value'], moduleLabel: 'feature' })
      .withRenamedExport({ currentExportKey: 'value', newExportKey: 'answer' });
    const container = DiBag.createBuilder().withInstalledModules([feature]).buildContainer();
    expect(container.resolve('answer')).toBe(1);
    await container.close();
  });

  test('module rename snapshots the option bag once and classifies bag and export failures', () => {
    const feature = DiBag.createBuilder().withServices({ value: () => 1 })
      .buildModule({ exportedServiceKeys: ['value'] });
    let currentReads = 0;
    let newReads = 0;
    const options = Object.defineProperties({}, {
      currentExportKey: { enumerable: true, get() { currentReads++; return 'value'; } },
      newExportKey: { enumerable: true, get() { newReads++; return 'answer'; } },
    }) as { currentExportKey: 'value'; newExportKey: 'answer' };
    const renamed = feature.withRenamedExport(options);
    expect({ currentReads, newReads }).toEqual({ currentReads: 1, newReads: 1 });
    expect(renamed).not.toBe(feature);
    const callRename = (renameOptions: unknown) =>
      (feature.withRenamedExport as unknown as (options: unknown) => unknown)(renameOptions);

    try {
      callRename({ currentExportKey: 'value', newExportKey: 'answer', extra: true });
      throw new Error('expected malformed bag rejection');
    } catch (error: any) {
      expect(error).toMatchObject({ code: 'DI_BAG_INVALID_ARGUMENT', details: {
        operation: 'withRenamedExport', argument: 'options',
        expected: 'only the own properties: currentExportKey, newExportKey',
      } });
    }
    try {
      callRename({ currentExportKey: 'missing', newExportKey: 'answer' });
      throw new Error('expected missing export rejection');
    } catch (error: any) {
      expect(error).toMatchObject({ code: 'DI_BAG_INVALID_EXPORT', details: {
        operation: 'withRenamedExport', currentExportKey: 'missing', newExportKey: 'answer',
      } });
      expect(error.message).toContain('withRenamedExport requires an existing export');
    }
  });

  test('delivers lifecycle events and failures through the renamed callbacks', async () => {
    const kinds: string[] = [];
    const failures: unknown[] = [];
    const observed = DiBag.withConfiguration({ lifecycleObservers: [{
      onLifecycleEvent(event) { kinds.push(event.kind); if (event.kind === 'scope-opened') throw new Error('observer'); },
      onObserverFailure(failure) { failures.push(failure.error); },
    }] });
    const container = observed.createBuilder().buildContainer();
    await container.close();
    await new Promise<void>(resolve => queueMicrotask(resolve));
    expect(kinds).toEqual(['scope-opened', 'scope-closing', 'scope-closed']);
    expect(failures).toHaveLength(1);
  });

  test('keeps legacy observers working throughout expand', async () => {
    const kinds: string[] = [];
    const observed = DiBag.withConfiguration({ observers: [{
      onEvent(event) { kinds.push(`old:${event.kind}`); },
      onError() {},
    }] });
    const container = observed.createBuilder().buildContainer();
    await container.close();
    await new Promise<void>(resolve => queueMicrotask(resolve));
    expect(kinds).toEqual(['old:scope-opened', 'old:scope-closing', 'old:scope-closed']);
  });

  test('composes legacy and renamed observer configurations', async () => {
    const kinds: string[] = [];
    const oldConfigured = DiBag.withConfiguration({ observers: [{
      onEvent(event) { kinds.push(`old:${event.kind}`); }, onError() {},
    }] });
    const mixed = oldConfigured.withConfiguration({ lifecycleObservers: [{
      onLifecycleEvent(event) { kinds.push(`new:${event.kind}`); }, onObserverFailure() {},
    }] });
    const container = mixed.createBuilder().buildContainer();
    await container.close();
    await new Promise<void>(resolve => queueMicrotask(resolve));
    expect(kinds).toContain('old:scope-opened');
    expect(kinds).toContain('new:scope-opened');
  });

  test('rejects both observer fields in one options bag', () => {
    expect(() => DiBag.withConfiguration({ observers: [], lifecycleObservers: [] } as never)).toThrow('observers or lifecycleObservers, not both');
  });

  test('snapshots renamed callbacks once and rejects callable observer records', async () => {
    const kinds: string[] = [];
    let eventReads = 0;
    let failureReads = 0;
    const observer = Object.defineProperties({}, {
      onLifecycleEvent: {
        configurable: true, enumerable: true,
        get() { eventReads++; return (event: { kind: string }) => { kinds.push(event.kind); }; },
      },
      onObserverFailure: {
        configurable: true, enumerable: true,
        get() { failureReads++; return () => {}; },
      },
    });
    const observed = DiBag.withConfiguration({ lifecycleObservers: [observer as never] });
    Object.defineProperties(observer, {
      onLifecycleEvent: { enumerable: true, value: () => { throw new Error('mutated'); } },
      onObserverFailure: { enumerable: true, value: () => { throw new Error('mutated'); } },
    });
    const container = observed.createBuilder().buildContainer();
    await container.close();
    await new Promise<void>(resolve => queueMicrotask(resolve));
    expect({ eventReads, failureReads }).toEqual({ eventReads: 1, failureReads: 1 });
    expect(kinds).toEqual(['scope-opened', 'scope-closing', 'scope-closed']);

    const callable = Object.assign(() => {}, { onLifecycleEvent() {}, onObserverFailure() {} });
    expect(() => DiBag.withConfiguration({ lifecycleObservers: [callable as never] })).toThrow('require onLifecycleEvent and onObserverFailure callbacks');
  });
});
