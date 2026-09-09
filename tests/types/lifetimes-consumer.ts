import { graph, scoped, independent, raw, native, metadata, moduleBag, frames, asyncFrames, capability, mapped, asyncMapped, rebound, bound, token, tokenFork, mixed, wrappedMixed, explicitDefault, reflectedScope, reflectedFork } from './lifetimes';
import type { ProviderAcquired, ProviderMetadata, ProviderOutput, ProviderAcquisitionMetadata, Provider } from '../../src';
import type { ProviderGraph } from '../../src/provider';
import type { TokenGraph } from '../../src/token-types';
import type { Assert, Equal } from './assert';
import type { Lifetime } from '../../src';
export type LifetimeCheck = Assert<Equal<Lifetime, 'root' | 'scoped' | 'transient'>>;
type IsAny<T> = 0 extends (1 & T) ? true : false;
export const repo = graph.resolve('repo');
export const db = scoped.resolve('db');
export const forked = independent.resolve('repo');
export const installed = moduleBag.resolve('raw');
export type Checks = [
  Assert<Equal<typeof repo, number>>, Assert<Equal<typeof db, { query(): number }>>, Assert<Equal<typeof forked, number>>,
  Assert<Equal<IsAny<typeof installed>, false>>, Assert<Equal<typeof installed, Promise<{ id: number }>>>,
  Assert<Equal<ProviderAcquired<typeof raw>, Promise<{ id: number }>>>, Assert<Equal<ProviderAcquired<typeof native>, { id: number }>>,
  Assert<Equal<ProviderOutput<typeof metadata>, Promise<{ id: number }>>>, Assert<Equal<ProviderMetadata<typeof metadata>, Readonly<{ owner: 'app' }>>>,
  Assert<Equal<ProviderAcquired<typeof frames>, Promise<{ id: number }>>>,
  Assert<Equal<ProviderAcquisitionMetadata<typeof frames>, readonly [Readonly<{ frame: number }>]>>,
  Assert<Equal<ProviderAcquisitionMetadata<typeof asyncFrames>, readonly [Readonly<{}>]>>,
  Assert<Equal<ProviderAcquired<typeof asyncFrames>, number>>, Assert<Equal<ProviderAcquired<typeof capability>, Promise<number>>>,
  Assert<Equal<ProviderAcquired<typeof mapped>, Promise<{ id: number }>>>, Assert<Equal<ProviderAcquired<typeof asyncMapped>, { id: number }>>,
  Assert<Equal<ProviderGraph<typeof rebound>, ProviderGraph<typeof bound>>>,
  Assert<Equal<ProviderGraph<typeof explicitDefault>, TokenGraph>>, Assert<Equal<typeof explicitDefault, Provider<() => number>>>,
  Assert<Equal<ProviderOutput<NoInfer<typeof mixed>>, number>>, Assert<Equal<ProviderOutput<typeof wrappedMixed>, number>>,
  Assert<Equal<IsAny<typeof wrappedMixed>, false>>, Assert<Equal<ReturnType<typeof reflectedScope>, typeof graph>>,
  Assert<Equal<Parameters<typeof reflectedScope>, []>>, Assert<Equal<IsAny<ReturnType<typeof reflectedFork>>, false>>,
];
export const tokenValue = tokenFork.resolve(token);
export type TokenCheck = Assert<Equal<typeof tokenValue, number>>;
