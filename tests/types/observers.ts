import { DiBag, type LifecycleEvent, type LifecycleObserver, type ObserverFailure, type ConfigurationOptions, type ObserverCallback, type ObserverErrorCallback } from '../../src';
import type { Assert, Equal } from './assert';
export const onEvent = (event: LifecycleEvent) => event.kind;
export const onError = (failure: ObserverFailure) => failure.error;
export const options = { onLifecycleEvent: onEvent, onObserverFailure: onError } satisfies LifecycleObserver;
export const observed = DiBag.withConfiguration({ lifecycleObservers: [options] });
export const observe = observed.withConfiguration;
export const configure = observed.withConfiguration;
export const begin = observed.createBuilder;
export const provider = observed.providerWithRegistrationMetadata({ provider: observed.createProvider(() => Promise.resolve({ value: 1 }), { factoryReturnKind: 'uninspected' }), registrationMetadata: { team: 'core' as const } });
export const builder = observed.createBuilder().withServices({ value: provider }).withServiceAlias({ aliasKey: 'copy', targetServiceKey: 'value' });
export const bag = builder.buildContainer();
export const resolve = bag.resolve;
export const inspect = bag.serviceSnapshot;
export const feature = observed.createBuilder().withServices({ value: provider }).buildModule({ exportedServiceKeys: ['value'] });
export const installed = observed.createBuilder().withInstalledModules([feature]).buildContainer();
export const fork = bag.createIndependentContainer();
export const child = bag.createChildContainer({ sharedParentServiceKeys: ['copy'] });
export const value = bag.resolve('copy');
export function inferredObserver() { return observed.withConfiguration({ lifecycleObservers: [{ onLifecycleEvent(event) { return event.kind; }, onObserverFailure(failure) { return failure.error; } }] }); }
export const onLifecycleEvent = (event: LifecycleEvent) => event.kind;
export const onObserverFailure = (failure: ObserverFailure) => failure.error;
export const lifecycleObserver = { onLifecycleEvent, onObserverFailure } satisfies LifecycleObserver;
export const lifecycleObserved = DiBag.withConfiguration({ lifecycleObservers: [lifecycleObserver] });
export function inferredLifecycleObserver() {
  return lifecycleObserved.withConfiguration({ lifecycleObservers: [{
    onLifecycleEvent(event) { return event.kind; },
    onObserverFailure(failure) { return failure.error; },
  }] });
}
export type Exact = [Assert<Equal<typeof value, Promise<{ value: number }>>>,
  Assert<Equal<Parameters<typeof observe>, [options: ConfigurationOptions]>>,
  Assert<Equal<Parameters<ObserverCallback>, [event: LifecycleEvent]>>,
  Assert<Equal<Parameters<ObserverErrorCallback>, [failure: ObserverFailure]>>,
  Assert<Equal<ThisParameterType<ObserverCallback>, void>>,
  Assert<Equal<ReturnType<typeof observe>, typeof DiBag>>];
export function narrow(event: LifecycleEvent) {
  if (event.kind === 'acquisition-ready') {
    const id: symbol = event.acquisitionId;
    const metadata: Readonly<object> = event.registrationMetadata;
    const frame = event.acquisitionMetadata[0];
    if (frame?.isPresent) { const value: unknown = frame.value; void value; }
    return [id, metadata] as const;
  }
  if (event.kind === 'disposal-failed') return event.disposalSequence;
  if (event.kind === 'disposal-completed') { const outcome: 'success' | 'failure' = event.outcome; return outcome; }
  return event.containerId;
}
