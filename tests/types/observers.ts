import { DiBag, type LifecycleEvent, type ObserverFailure, type ObserverOptions, type ObserverCallback, type ObserverErrorCallback } from '../../src';
import type { Assert, Equal } from './assert';
export const onEvent = (event: LifecycleEvent) => event.kind;
export const onError = (failure: ObserverFailure) => failure.error;
export const options = { onEvent, onError } satisfies ObserverOptions;
export const observed = DiBag.observe(options);
export const observe = observed.observe;
export const configure = observed.configure;
export const begin = observed.begin;
export const module = observed.module;
export const provider = observed.withMetadata(observed.factory(() => Promise.resolve({ value: 1 }), { acquisition: 'raw' }), { team: 'core' as const });
export const builder = observed.begin().add({ value: provider }).alias('copy', 'value');
export const bag = builder.end();
export const resolve = bag.resolve;
export const inspect = bag.inspect;
export const feature = observed.module().add({ value: provider }).exports(['value']);
export const installed = observed.begin().install(feature).end();
export const fork = bag.fork();
export const child = bag.scope({ share: ['copy'] });
export const value = bag.resolve('copy');
export function inferredObserver() { return observed.observe({ onEvent(event) { return event.kind; }, onError(failure) { return failure.error; } }); }
export type Exact = [Assert<Equal<typeof value, Promise<{ value: number }>>>,
  Assert<Equal<Parameters<typeof observe>, [options: ObserverOptions]>>,
  Assert<Equal<Parameters<ObserverCallback>, [event: LifecycleEvent]>>,
  Assert<Equal<Parameters<ObserverErrorCallback>, [failure: ObserverFailure]>>,
  Assert<Equal<ThisParameterType<ObserverCallback>, void>>,
  Assert<Equal<ReturnType<typeof observe>, typeof DiBag>>];
export function narrow(event: LifecycleEvent) {
  if (event.kind === 'acquisition-ready') {
    const id: symbol = event.acquisitionId;
    const metadata: Readonly<object> = event.metadata;
    const frame = event.frames[0];
    if (frame?.present) { const value: unknown = frame.value; void value; }
    return [id, metadata] as const;
  }
  if (event.kind === 'cleanup-failed') return event.disposalIndex;
  if (event.kind === 'cleanup-completed') { const outcome: 'success' | 'failure' = event.outcome; return outcome; }
  return event.scopeId;
}
