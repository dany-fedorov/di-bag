import { DiBag } from '../../../src';
// A query-builder style value: callable `then`, not a Promise. Auto acquisition rejects it at runtime.
class QueryBuilder { where() { return this; } then(onFulfilled: (rows: number[]) => void) { onFulfilled([]); } }
// diagnostic: factory output is a structural thenable: users; return a native Promise or use DiBag.createProvider with factoryReturnKind 'uninspected' or 'native-promise'; see https://dany-fedorov.github.io/di-bag/agent/errors.html#structural-thenable
DiBag.createBuilder().withServices({ users: () => new QueryBuilder() });
// diagnostic: factory output is a structural thenable; return a native Promise or select factoryReturnKind 'uninspected' or 'native-promise'; see https://dany-fedorov.github.io/di-bag/agent/errors.html#structural-thenable
DiBag.createBuilder().withServices({ owned: DiBag.providerWithDisposal({ provider: () => new QueryBuilder(), disposeService: () => {} }) });
// diagnostic: factory output is a structural thenable: maybe; return a native Promise or use DiBag.createProvider with factoryReturnKind 'uninspected' or 'native-promise'; see https://dany-fedorov.github.io/di-bag/agent/errors.html#structural-thenable
DiBag.createBuilder().withServices({ maybe: (): QueryBuilder | undefined => undefined });
declare const promiseLike: PromiseLike<number>;
// diagnostic: factory output is a structural thenable: like; return a native Promise or use DiBag.createProvider with factoryReturnKind 'uninspected' or 'native-promise'; see https://dany-fedorov.github.io/di-bag/agent/errors.html#structural-thenable
DiBag.createBuilder().withServices({ like: () => promiseLike });
const key = Symbol('users');
const usersToken = DiBag.createToken(key).forService<QueryBuilder>();
// diagnostic: factory output is a structural thenable: typed token; return a native Promise or use DiBag.createProvider with factoryReturnKind 'uninspected' or 'native-promise'; see https://dany-fedorov.github.io/di-bag/agent/errors.html#structural-thenable
DiBag.createBuilder().withTokenService(usersToken, () => new QueryBuilder());
// diagnostic: factory output is a structural thenable; return a native Promise or select factoryReturnKind 'uninspected' or 'native-promise'; see https://dany-fedorov.github.io/di-bag/agent/errors.html#structural-thenable
DiBag.createProvider(() => new QueryBuilder());
// diagnostic: factory output is a structural thenable
// diagnostic-native-gap: last-contextual-factory-thenable
DiBag.createProvider((_deps: {}, context) => { void context.abortSignal; return new QueryBuilder(); }, { factoryReceivesContext: true });
// diagnostic: factory output is a structural thenable
DiBag.createProviderFromFunction({ dependencies: [], factoryFunction: () => new QueryBuilder() });
// diagnostic: factory output is a structural thenable
DiBag.createProviderFromClass({ dependencies: [], serviceClass: QueryBuilder });
