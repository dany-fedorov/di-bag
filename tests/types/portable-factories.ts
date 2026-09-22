import { DiBag } from '../../src';
import type { ProviderAcquiredValue, ProviderNamedDependencies, ProviderOutput } from '../../src';
import type { Assert, Equal } from './assert';

type Config = { readonly url: string };
type Db = { query(): Promise<string[]>; end(): Promise<void> };
export const config = DiBag.fromSyncFactory((): Config => ({ url: 'memory:' }));
export const dbSource = DiBag.fromAsyncFactory(async ({ config }: { config: Config }): Promise<Db> => ({ query: async () => [config.url], end: async () => {} }));
export const db = DiBag.withDisposal(dbSource, db => db.end());
export const contextualSync = DiBag.fromSyncFactory((deps: { config: Config }, factoryCtx) => {
  factoryCtx.pushDisposer(() => {});
  return { url: deps.config.url, signal: factoryCtx.signal };
}, { context: 'acquisition' });
export const contextualAsync = DiBag.fromAsyncFactory(async (_deps: {}, factoryCtx) => ({ signal: factoryCtx.signal }), { context: 'acquisition' });
export const anyOutput = DiBag.fromSyncFactory((): any => 1);
export const unknownOutput = DiBag.fromSyncFactory((): unknown => 1);
// A function-valued service is not a thenable, even when it returns a Promise.
export const callable = DiBag.fromSyncFactory(() => async () => 1);
export const optionalObject = DiBag.fromSyncFactory((): { id: number } | undefined => undefined);
class ServicePromise<T> extends Promise<T> {}
export const subclass = DiBag.fromAsyncFactory(() => ServicePromise.resolve(1 as const));
export const projected = DiBag.transformService(config, { mode: 'direct', transform: value => value.url, acquisitionMode: 'raw' });
export const feature = DiBag.createBuilder().withServices({ config, db }).buildModule({ exportedServiceKeys: ['db'], moduleLabel: 'storage' });
export const bag = DiBag.createBuilder().withInstalledModules([feature]).withServices({ config, contextualSync, contextualAsync, projected }).buildContainer();
export const resolved: Promise<Db> = bag.resolve('db');
export type Checks = [
  Assert<Equal<ProviderOutput<typeof config>, Config>>,
  Assert<Equal<ProviderAcquiredValue<typeof config>, Config>>,
  Assert<Equal<ProviderOutput<typeof dbSource>, Promise<Db>>>,
  Assert<Equal<ProviderAcquiredValue<typeof dbSource>, Db>>,
  Assert<Equal<ProviderAcquiredValue<typeof db>, Db>>,
  Assert<Equal<ProviderNamedDependencies<typeof dbSource>, { config: Config }>>,
  Assert<Equal<ProviderNamedDependencies<typeof contextualSync>, { config: Config }>>,
  Assert<Equal<ProviderOutput<typeof contextualSync>, { url: string; signal: AbortSignal }>>,
  Assert<Equal<ProviderOutput<typeof contextualAsync>, Promise<{ signal: AbortSignal }>>>,
  Assert<Equal<ProviderAcquiredValue<typeof contextualAsync>, { signal: AbortSignal }>>,
  Assert<Equal<ProviderAcquiredValue<typeof subclass>, 1>>,
  Assert<Equal<ProviderOutput<typeof projected>, string>>,
];
