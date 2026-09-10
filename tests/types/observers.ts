import { DiBag, type LifecycleEvent, type ObserverFailure, type ObserverOptions, type ConfigurationOptions, type ObserverCallback, type ObserverErrorCallback } from '../../src';
import type { Assert, Equal } from './assert';
export const onEvent = (event: LifecycleEvent) => event.kind;
export const onError = (failure: ObserverFailure) => failure.error;
export const options = { onEvent, onError } satisfies ObserverOptions;
export const observed = DiBag.withConfiguration({ observers: [options] });
export const observe = observed.withConfiguration;
export const configure = observed.withConfiguration;
export const begin = observed.createBuilder;
export const provider = observed.withMetadata(observed.fromFactory(() => Promise.resolve({ value: 1 }), { acquisitionMode: 'raw' }), { static: { team: 'core' as const } });
export const builder = observed.createBuilder().register({ value: provider }).alias('copy', 'value');
export const bag = builder.build();
export const resolve = bag.resolve;
export const inspect = bag.inspect;
export const feature = observed.createBuilder().register({ value: provider }).buildModule(['value']);
export const installed = observed.createBuilder().installModule(feature).build();
export const fork = bag.fork();
export const child = bag.createScope({ share: ['copy'] });
export const value = bag.resolve('copy');
export function inferredObserver() { return observed.withConfiguration({ observers: [{ onEvent(event) { return event.kind; }, onError(failure) { return failure.error; } }] }); }
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
    if (frame?.present) { const value: unknown = frame.value; void value; }
    return [id, metadata] as const;
  }
  if (event.kind === 'cleanup-failed') return event.disposalSequence;
  if (event.kind === 'cleanup-completed') { const outcome: 'success' | 'failure' = event.outcome; return outcome; }
  return event.scopeId;
}
