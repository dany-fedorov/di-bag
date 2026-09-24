import { graph, scoped, independent, raw, native, metadata, moduleBag, frames, asyncFrames, capability, mapped, asyncMapped, rebound, bound, token, tokenFork, mixed, wrappedMixed, explicitDefault, bareDefault, reflectedScope, reflectedFork } from './lifetimes';
import type { ProviderAcquiredValue, ProviderRegistrationMetadata, ProviderOutput, ProviderAcquisitionMetadata, Provider } from '../../src';
import type { ProviderGraphContract } from '../../src/provider';
import type { TokenDependencyContract } from '../../src/token-types';
import type { Assert, Equal } from './assert';
import type { CanonicalLifetime, Lifetime } from '../../src';
export type LifetimeCheck = Assert<Equal<Lifetime, 'singleton:one-per-container-tree' | 'scoped:one-per-container' | 'transient:one-per-resolve'>>;
type IsAny<T> = 0 extends (1 & T) ? true : false;
const callReflectedScope = () => reflectedScope();
export const repo = graph.resolve('repo');
export const db = scoped.resolve('db');
export const forked = independent.resolve('repo');
export const installed = moduleBag.resolve('raw');
export type Checks = [
  Assert<Equal<typeof repo, number>>, Assert<Equal<typeof db, { query: () => 1 }>>, Assert<Equal<typeof forked, number>>,
  Assert<Equal<IsAny<typeof installed>, false>>, Assert<Equal<typeof installed, Promise<{ id: number }>>>,
  Assert<Equal<ProviderAcquiredValue<typeof raw>, Promise<{ id: number }>>>, Assert<Equal<ProviderAcquiredValue<typeof native>, { id: number }>>,
  Assert<Equal<ProviderOutput<typeof metadata>, Promise<{ id: number }>>>, Assert<Equal<ProviderRegistrationMetadata<typeof metadata>, Readonly<{ owner: 'app' }>>>,
  Assert<Equal<ProviderAcquiredValue<typeof frames>, Promise<{ id: number }>>>,
  Assert<Equal<ProviderAcquisitionMetadata<typeof frames>, readonly [Readonly<{ frame: number }>]>>,
  Assert<Equal<ProviderAcquisitionMetadata<typeof asyncFrames>, readonly [Readonly<{}>]>>,
  Assert<Equal<ProviderAcquiredValue<typeof asyncFrames>, number>>, Assert<Equal<ProviderAcquiredValue<typeof capability>, Promise<number>>>,
  Assert<Equal<ProviderAcquiredValue<typeof mapped>, Promise<{ id: number }>>>, Assert<Equal<ProviderAcquiredValue<typeof asyncMapped>, { id: number }>>,
  Assert<Equal<ProviderGraphContract<typeof rebound>, ProviderGraphContract<typeof bound>>>,
  Assert<Equal<ProviderGraphContract<typeof explicitDefault>, TokenDependencyContract>>,
  Assert<Equal<CanonicalLifetime<{ value: typeof explicitDefault }, 'value'>, 'scoped:one-per-container'>>,
  Assert<Equal<ProviderGraphContract<typeof bareDefault>, TokenDependencyContract>>, Assert<Equal<typeof bareDefault, Provider<() => number>>>,
  Assert<Equal<ProviderOutput<NoInfer<typeof mixed>>, number>>, Assert<Equal<ProviderOutput<typeof wrappedMixed>, number>>,
  Assert<Equal<IsAny<typeof wrappedMixed>, false>>, Assert<Equal<ReturnType<typeof callReflectedScope>, typeof graph>>,
  Assert<Equal<IsAny<ReturnType<typeof reflectedScope>>, false>>,
  Assert<Equal<IsAny<ReturnType<typeof reflectedFork>>, false>>,
];
export const tokenValue = tokenFork.resolve(token);
export type TokenCheck = Assert<Equal<typeof tokenValue, number>>;
