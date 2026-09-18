import { config, dbSource, db, contextualSync, contextualAsync, subclass, bag } from './portable-factories';
import type { ProviderAcquiredValue, ProviderNamedDependencies, ProviderOutput } from '../../src';
import type { Assert, Equal } from './assert';

type Config = { readonly url: string };
type Db = { query(): Promise<string[]>; end(): Promise<void> };
export const pending = bag.resolve('db');
export type Contracts = [
  Assert<Equal<ProviderOutput<typeof config>, Config>>,
  Assert<Equal<ProviderAcquiredValue<typeof db>, Db>>,
  Assert<Equal<ProviderNamedDependencies<typeof dbSource>, { config: Config }>>,
  Assert<Equal<ProviderNamedDependencies<typeof contextualSync>, { config: Config }>>,
  Assert<Equal<ProviderOutput<typeof contextualAsync>, Promise<{ signal: AbortSignal }>>>,
  Assert<Equal<ProviderAcquiredValue<typeof subclass>, 1>>,
  Assert<Equal<typeof pending, Promise<Db>>>,
  Assert<Equal<0 extends (1 & typeof pending) ? true : false, false>>,
];
