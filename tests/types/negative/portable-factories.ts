import { DiBag } from '../../../src';
import type { AcquisitionContext } from '../../../src';
class QueryBuilder { then(onFulfilled: (rows: number[]) => void) { onFulfilled([]); } }
// diagnostic: fromSyncFactory output must not be a Promise or thenable; use fromAsyncFactory for a Promise, or fromFactory with acquisitionMode raw to make the Promise object the service; see https://dany-fedorov.github.io/di-bag/agent/errors.html#portable-factory-output
DiBag.fromSyncFactory(async () => 1);
// diagnostic: fromSyncFactory output must not be a Promise or thenable
DiBag.fromSyncFactory(() => Promise.resolve(1));
// diagnostic: fromSyncFactory output must not be a Promise or thenable
DiBag.fromSyncFactory((): number | Promise<number> => 1);
// diagnostic: fromSyncFactory output must not be a Promise or thenable
DiBag.fromSyncFactory(() => new QueryBuilder());
// diagnostic: fromSyncFactory output must not be a Promise or thenable
// diagnostic-native-gap: last-contextual-sync-factory-promise
DiBag.fromSyncFactory(async (_deps: {}, _factoryCtx) => 1, { context: 'acquisition' });
// diagnostic: fromAsyncFactory requires a Promise output; use fromSyncFactory for a synchronous value; see https://dany-fedorov.github.io/di-bag/agent/errors.html#portable-factory-output
DiBag.fromAsyncFactory(() => 1);
// diagnostic: fromAsyncFactory requires a Promise output
DiBag.fromAsyncFactory((): number | Promise<number> => 1);
declare const promiseLike: PromiseLike<number>;
// diagnostic: fromAsyncFactory requires a Promise output
DiBag.fromAsyncFactory(() => promiseLike);
// diagnostic: fromAsyncFactory requires a Promise output
DiBag.fromAsyncFactory((_deps: {}, _factoryCtx: AcquisitionContext) => 1, { context: 'acquisition' });
// diagnostic: not assignable
DiBag.fromSyncFactory(() => 1, { acquisitionMode: 'raw' });
// diagnostic: not assignable
DiBag.fromAsyncFactory(async () => 1, { acquisitionMode: 'nativePromise' });
// diagnostic: not assignable
DiBag.fromSyncFactory(() => 1, { context: 'acquisition', ...{ acquisitionMode: 'raw' } });
// diagnostic: not assignable
DiBag.fromSyncFactory(function (this: { id: number }) { return this.id; });
// diagnostic: Target signature provides too few arguments
DiBag.fromSyncFactory((_deps: {}, _factoryCtx: AcquisitionContext, extra: number) => extra, { context: 'acquisition' });
// diagnostic: not assignable
DiBag.fromSyncFactory(() => 1, { context: 'later' });
