import { observed, observe, configure, begin, builder, bag, installed, fork, child, provider, feature, inferredObserver } from './observers';
import type { Assert, Equal } from './assert';
import type { ProviderOutput, ProviderAcquiredValue, ProviderRegistrationMetadata, LifecycleEvent, ObserverFailure } from '../../src';
const composed = observe({ observers: [{ onEvent: async event => event.kind, onError: async failure => failure.error }] }).withConfiguration({ runtime: { isNativePromise: () => false } });
const configured = configure({ runtime: { isNativePromise: () => false } });
const result = bag.resolve('copy');
const inspected = child.inspect('value');
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
bag.fork(['value'], { value: () => 1 });
// @ts-expect-error required error callback survives inference and physical declarations
observe({ observers: [{ onEvent(event: LifecycleEvent) {} }] });
// @ts-expect-error required receiver is incompatible with observer invocation
observe({ observers: [{ onEvent(this: { value: number }, event: LifecycleEvent) {}, onError(failure: ObserverFailure) {} }] });
