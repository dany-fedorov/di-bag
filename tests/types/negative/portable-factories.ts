import { DiBag } from '../../../src';
import type { FactoryContext } from '../../../src';
class QueryBuilder { then(onFulfilled: (rows: number[]) => void) { onFulfilled([]); } }
// diagnostic: sync-value output must not be a Promise or thenable; use factoryReturnKind 'native-promise' for a Promise, or 'uninspected' to make the Promise object the service; see https://dany-fedorov.github.io/di-bag/agent/errors.html#portable-factory-output
DiBag.createProvider(async () => 1, { factoryReturnKind: 'sync-value' });
// diagnostic: sync-value output must not be a Promise or thenable
DiBag.createProvider(() => Promise.resolve(1), { factoryReturnKind: 'sync-value' });
// diagnostic: sync-value output must not be a Promise or thenable
DiBag.createProvider((): number | Promise<number> => 1, { factoryReturnKind: 'sync-value' });
// diagnostic: sync-value output must not be a Promise or thenable
DiBag.createProvider(() => new QueryBuilder(), { factoryReturnKind: 'sync-value' });
// diagnostic: sync-value output must not be a Promise or thenable
// diagnostic-native-gap: last-contextual-sync-factory-promise
DiBag.createProvider(async (_deps: {}, _factoryCtx) => 1, { factoryReturnKind: 'sync-value', factoryReceivesContext: true });
// diagnostic: native-promise factory return kind requires a Promise output
DiBag.createProvider(() => 1, { factoryReturnKind: 'native-promise' });
// diagnostic: native-promise factory return kind requires a Promise output
DiBag.createProvider((): number | Promise<number> => 1, { factoryReturnKind: 'native-promise' });
declare const promiseLike: PromiseLike<number>;
// diagnostic: native-promise factory return kind requires a Promise output
DiBag.createProvider(() => promiseLike, { factoryReturnKind: 'native-promise' });
// diagnostic: native-promise factory return kind requires a Promise output
DiBag.createProvider((_deps: {}, _factoryCtx: FactoryContext) => 1, { factoryReturnKind: 'native-promise', factoryReceivesContext: true });
// diagnostic: not assignable
DiBag.fromSyncFactory(() => 1, { acquisitionMode: 'raw' });
// diagnostic: not assignable
DiBag.fromAsyncFactory(async () => 1, { acquisitionMode: 'nativePromise' });
// diagnostic: not assignable
DiBag.fromSyncFactory(() => 1, { context: 'acquisition', ...{ acquisitionMode: 'raw' } });
// diagnostic: not assignable
DiBag.createProvider(function (this: { id: number }) { return this.id; }, { factoryReturnKind: 'sync-value' });
// diagnostic: Target signature provides too few arguments
DiBag.createProvider((_deps: {}, _factoryCtx: FactoryContext, extra: number) => extra, { factoryReturnKind: 'sync-value', factoryReceivesContext: true });
// diagnostic: not assignable
DiBag.fromSyncFactory(() => 1, { context: 'later' });
