import { transform } from './provider';
import type { Provider, ProviderAcquisitionMetadata, ProviderNeeds, ProviderOutput, RetainedMetadata, ProviderGraph } from './provider';
import type { Registration } from './registration';
import type { Unsatisfied } from './types';

type Mode = 'sync' | 'async' | 'sync-first';
type Callable = (...args: never[]) => unknown;
type MethodError<B, C> = C extends Callable
  ? [] extends Parameters<C> ? B extends ThisParameterType<C> ? never : 'invalid sas-box capability'
    : 'invalid sas-box capability' : 'invalid sas-box capability';
type CapabilityError<B, K extends PropertyKey> = B extends Record<K, infer C> ? MethodError<B, C> : 'invalid sas-box capability';
type SyncFirstError<B> = B extends { sync: infer C }
  ? C extends undefined ? CapabilityError<B, 'async'> : MethodError<B, C>
  : 'sync-first requires the complete sync capability field';
type RouteError<B, M extends Mode> = M extends 'sync' ? CapabilityError<B, 'sync'>
  : M extends 'async' ? CapabilityError<Awaited<B>, 'async'> : SyncFirstError<Awaited<B>>;
type Valid<R extends Registration, M extends Mode> = [RouteError<ProviderOutput<R>, M>] extends [never] ? unknown
  : Unsatisfied<RouteError<ProviderOutput<R>, M>, {}>;
type Result<B, K extends PropertyKey> = B extends Record<K, infer C> ? C extends Callable ? ReturnType<C> : never : never;
type FirstResult<B> = B extends { sync: infer C } ? C extends undefined ? Result<B, 'async'> : C extends Callable ? ReturnType<C> : never : never;
type Output<B, M extends Mode> = M extends 'sync' ? Result<B, 'sync'>
  : M extends 'async' ? Promise<Awaited<Result<Awaited<B>, 'async'>>> : Promise<Awaited<FirstResult<Awaited<B>>>>;

/** Explicitly select a structural sas-box capability; never transfer ownership. */
export function fromSasBox<R extends Registration, M extends Mode>(
  registration: R & Registration,
  options: { readonly mode: M } & Valid<NoInfer<R>, NoInfer<M>>,
): Provider<(this: void, deps: ProviderNeeds<R>) => Output<ProviderOutput<R>, M>, RetainedMetadata<R>, ProviderAcquisitionMetadata<R>, ProviderGraph<R>> {
  const { mode } = options;
  if (mode !== 'sync' && mode !== 'async' && mode !== 'sync-first') throw new Error('invalid sas-box mode');
  return transform(registration, {
    kind: mode === 'sync' ? 'map-sync' : 'map-async',
    project(value: unknown) {
      if (value === null || (typeof value !== 'object' && typeof value !== 'function')) throw new Error('invalid sas-box capability');
      const box = value as { sync?: unknown; async?: unknown };
      const sync = mode === 'async' ? undefined : box.sync;
      const selected = mode === 'sync' || (mode === 'sync-first' && typeof sync === 'function') ? sync : box.async;
      if (typeof selected !== 'function') throw new Error('invalid sas-box capability');
      return Reflect.apply(selected, box, []);
    },
  });
}
