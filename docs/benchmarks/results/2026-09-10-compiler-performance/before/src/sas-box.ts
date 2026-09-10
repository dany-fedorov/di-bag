import { transform } from './provider';
import type { Provider, ProviderAcquisitionMetadata, ProviderNeeds, ProviderOutput, RetainedMetadata, ProviderGraph } from './provider';
import type { Registration } from './registration';
import type { Unsatisfied } from './types';
import { acquisitionMode } from './acquisition-mode';
import type { Acquired, AcquisitionMode, NativeOutput, ModeOptions } from './acquisition-mode';

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
type AcquisitionOptions<M extends Mode, A extends AcquisitionMode> = [M] extends ['sync'] ? ModeOptions<A> : { readonly acquisition?: never };

/**
 * Adapt a structural sas-box capability without transferring ownership.
 * `sync` invokes the immediate capability, `async` awaits the box and async capability,
 * and `sync-first` prefers a defined synchronous capability before falling back to async.
 * @param registration - A registration exposing the required structural box capability.
 * @param options - Required capability mode; acquisition is accepted only for `sync`.
 * @returns A provider retaining source dependencies, metadata, frames, lifetime, and ownership.
 * @throws If the selected runtime capability is missing or not callable.
 */
export function fromSasBox<R extends Registration, M extends Mode, A extends AcquisitionMode = 'auto'>(
  registration: R & Registration,
  options: { readonly mode: M } & AcquisitionOptions<M, A> & Valid<NoInfer<R>, NoInfer<M>> & NativeOutput<Output<ProviderOutput<NoInfer<R>>, NoInfer<M>>, NoInfer<A>>,
): Provider<(this: void, deps: ProviderNeeds<R>) => Output<ProviderOutput<R>, M>, RetainedMetadata<R>, ProviderAcquisitionMetadata<R>, ProviderGraph<R>, Acquired<Output<ProviderOutput<R>, M>, M extends 'sync' ? A : 'native'>> {
  const { mode } = options;
  if (mode !== 'sync' && mode !== 'async' && mode !== 'sync-first') throw new Error('invalid sas-box mode');
  if (mode !== 'sync' && 'acquisition' in options) throw new Error('acquisition options require the synchronous sas-box mode');
  const acquisition = mode === 'sync' ? acquisitionMode(options) : 'native';
  return transform(registration, {
    kind: mode === 'sync' ? 'map-sync' : 'map-async',
    acquisition: mode === 'sync' ? acquisition : 'native',
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
