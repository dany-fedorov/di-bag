import { observed, observe, configure, begin, module, builder, bag, installed, fork, child, provider, feature, inferredObserver } from './observers';
import type { Assert, Equal } from './assert';
import type { ProviderOutput, ProviderAcquired, ProviderMetadata, LifecycleEvent, ObserverFailure } from '../../src';
const composed = observe({ onEvent: async event => event.kind, onError: async failure => failure.error }).configure({ isNativePromise: () => false });
const configured = configure({ isNativePromise: () => false });
const result = bag.resolve('copy');
const inspected = child.inspect('value');
export type Exact = [Assert<Equal<typeof result, Promise<{ value: number }>>>,
  Assert<Equal<ProviderOutput<typeof provider>, Promise<{ value: number }>>>,
  Assert<Equal<ProviderAcquired<typeof provider>, Promise<{ value: number }>>>,
  Assert<Equal<ProviderMetadata<typeof provider>, Readonly<{ team: 'core' }>>>,
  Assert<Equal<ReturnType<typeof inferredObserver>, typeof observed>>,
  Assert<Equal<typeof inspected.metadata, Readonly<{ team: 'core' }>>>];
begin().install(feature).end().resolve('value');
module().add({ value: provider }).exports(['value']);
installed.resolve('value'); fork.resolve('copy'); builder.end();
composed.begin().end(); configured.begin().end();
// @ts-expect-error provider output remains exact through observed facade declarations
bag.fork(['value'], { value: () => 1 });
// @ts-expect-error required error callback survives inference and physical declarations
observe({ onEvent(event: LifecycleEvent) {} });
// @ts-expect-error required receiver is incompatible with observer invocation
observe({ onEvent(this: { value: number }, event: LifecycleEvent) {}, onError(failure: ObserverFailure) {} });
