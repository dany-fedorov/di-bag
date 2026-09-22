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
});
