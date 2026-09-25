import { DiBag } from '../../src';
import type { ProviderAcquiredValue, ProviderNamedDependencies, ProviderOutput } from '../../src';
import type { Assert, Equal } from './assert';

type Config = { readonly url: string };
type Db = { query(): Promise<string[]>; end(): Promise<void> };
export const config = DiBag.createProvider((): Config => ({ url: 'memory:' }), { factoryReturnKind: 'sync-value' });
export const dbSource = DiBag.createProvider(async ({ config }: { config: Config }): Promise<Db> => ({ query: async () => [config.url], end: async () => {} }), { factoryReturnKind: 'native-promise' });
export const db = DiBag.providerWithDisposal({ provider: dbSource, disposeService: db => db.end() });
export const contextualSync = DiBag.createProvider((deps: { config: Config }, factoryCtx) => {
  factoryCtx.pushDisposer(() => {});
  return { url: deps.config.url, signal: factoryCtx.abortSignal };
}, { factoryReturnKind: 'sync-value', factoryReceivesContext: true });
export const contextualAsync = DiBag.createProvider(async (_deps: {}, factoryCtx) => ({ signal: factoryCtx.abortSignal }), { factoryReturnKind: 'native-promise', factoryReceivesContext: true });
export const anyOutput = DiBag.createProvider((): any => 1, { factoryReturnKind: 'sync-value' });
export const unknownOutput = DiBag.createProvider((): unknown => 1, { factoryReturnKind: 'sync-value' });
// A function-valued service is not a thenable, even when it returns a Promise.
export const callable = DiBag.createProvider(() => async () => 1, { factoryReturnKind: 'sync-value' });
export const optionalObject = DiBag.createProvider((): { id: number } | undefined => undefined, { factoryReturnKind: 'sync-value' });
class ServicePromise<T> extends Promise<T> {}
export const subclass = DiBag.createProvider(() => ServicePromise.resolve(1 as const), { factoryReturnKind: 'native-promise' });
export const projected = DiBag.providerWithTransformedService({ provider: config, transformService: value => value.url, callbackReceives: 'exposed-service', transformReturnKind: 'uninspected' });
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
