import { DiBag } from '../../../src';
// A query-builder style value: callable `then`, not a Promise. Auto acquisition rejects it at runtime.
class QueryBuilder { where() { return this; } then(onFulfilled: (rows: number[]) => void) { onFulfilled([]); } }
// diagnostic: factory output is a structural thenable: users; return a native Promise or use DiBag.fromFactory with acquisitionMode raw or nativePromise; see https://dany-fedorov.github.io/di-bag/agent/errors.html#structural-thenable
DiBag.createBuilder().register({ users: () => new QueryBuilder() });
// diagnostic: factory output is a structural thenable: owned; return a native Promise or use DiBag.fromFactory with acquisitionMode raw or nativePromise; see https://dany-fedorov.github.io/di-bag/agent/errors.html#structural-thenable
DiBag.createBuilder().register({ owned: DiBag.withDisposal(() => new QueryBuilder(), () => {}) });
// diagnostic: factory output is a structural thenable: maybe; return a native Promise or use DiBag.fromFactory with acquisitionMode raw or nativePromise; see https://dany-fedorov.github.io/di-bag/agent/errors.html#structural-thenable
DiBag.createBuilder().register({ maybe: (): QueryBuilder | undefined => undefined });
declare const promiseLike: PromiseLike<number>;
// diagnostic: factory output is a structural thenable: like; return a native Promise or use DiBag.fromFactory with acquisitionMode raw or nativePromise; see https://dany-fedorov.github.io/di-bag/agent/errors.html#structural-thenable
DiBag.createBuilder().register({ like: () => promiseLike });
const key = Symbol('users');
const usersToken = DiBag.token(key).of<QueryBuilder>();
// diagnostic: factory output is a structural thenable: typed token; return a native Promise or use DiBag.fromFactory with acquisitionMode raw or nativePromise; see https://dany-fedorov.github.io/di-bag/agent/errors.html#structural-thenable
DiBag.createBuilder().register(usersToken, () => new QueryBuilder());
// diagnostic: factory output is a structural thenable; return a native Promise or select acquisitionMode raw or nativePromise; see https://dany-fedorov.github.io/di-bag/agent/errors.html#structural-thenable
DiBag.fromFactory(() => new QueryBuilder());
// diagnostic: factory output is a structural thenable
// diagnostic-native-gap: last-contextual-factory-thenable
DiBag.fromFactory((_deps: {}, context) => { void context.signal; return new QueryBuilder(); }, { context: 'acquisition' });
// diagnostic: factory output is a structural thenable
DiBag.fromFunction([], () => new QueryBuilder());
// diagnostic: factory output is a structural thenable
DiBag.fromClass([], QueryBuilder);
