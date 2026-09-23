import { observed, observe, configure, begin, builder, bag, installed, fork, child, provider, feature, inferredObserver, lifecycleObserved, inferredLifecycleObserver } from './observers';
import type { Assert, Equal } from './assert';
import type { ProviderOutput, ProviderAcquiredValue, ProviderRegistrationMetadata, LifecycleEvent, ObserverFailure } from '../../src';
const composed = observe({ lifecycleObservers: [{ onLifecycleEvent: async event => event.kind, onObserverFailure: async failure => failure.error }] }).withConfiguration({ runtime: { isNativePromise: () => false } });
const configured = configure({ runtime: { isNativePromise: () => false } });
const result = bag.resolve('copy');
const inspected = child.serviceSnapshot('value');
export type Exact = [Assert<Equal<typeof result, Promise<{ value: number }>>>,
  Assert<Equal<ProviderOutput<typeof provider>, Promise<{ value: number }>>>,
  Assert<Equal<ProviderAcquiredValue<typeof provider>, Promise<{ value: number }>>>,
  Assert<Equal<ProviderRegistrationMetadata<typeof provider>, Readonly<{ team: 'core' }>>>,
  Assert<Equal<ReturnType<typeof inferredObserver>, typeof observed>>,
  Assert<Equal<typeof inspected.registrationMetadata, Readonly<{ team: 'core' }>>>];
begin().withInstalledModules([feature]).buildContainer().resolve('value');
begin().withServices({ value: provider }).buildModule({ exportedServiceKeys: ['value'] });
installed.resolve('value'); fork.resolve('copy'); builder.buildContainer();
composed.createBuilder().buildContainer(); configured.createBuilder().buildContainer();
// @ts-expect-error provider output remains exact through observed facade declarations
bag.createIndependentContainer(['value'], { value: () => 1 });
// @ts-expect-error required error callback survives inference and physical declarations
observe({ lifecycleObservers: [{ onLifecycleEvent(event: LifecycleEvent) {} }] });
// @ts-expect-error required receiver is incompatible with observer invocation
observe({ lifecycleObservers: [{ onLifecycleEvent(this: { value: number }, event: LifecycleEvent) {}, onObserverFailure(failure: ObserverFailure) {} }] });
const lifecycleComposed = lifecycleObserved.withConfiguration({ lifecycleObservers: [{
  onLifecycleEvent: async event => event.kind,
  onObserverFailure: async failure => failure.error,
}] });
const lifecycleExact: typeof lifecycleObserved = inferredLifecycleObserver();
lifecycleComposed.createBuilder().buildContainer();
void lifecycleExact;
// @ts-expect-error required failure callback survives declaration emission
lifecycleObserved.withConfiguration({ lifecycleObservers: [{ onLifecycleEvent(event: LifecycleEvent) {} }] });
// @ts-expect-error observer callbacks have a void receiver
lifecycleObserved.withConfiguration({ lifecycleObservers: [{ onLifecycleEvent(this: { owner: string }, event: LifecycleEvent) {}, onObserverFailure(failure: ObserverFailure) {} }] });
