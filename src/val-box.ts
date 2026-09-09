import { transform } from './provider';
import type { Provider, ProviderAcquisitionMetadata, ProviderNeeds, ProviderOutput, RetainedMetadata, ProviderGraph } from './provider';
import type { Presence } from './inspection';
import type { Registration } from './registration';
import type { Unsatisfied } from './types';
import { acquisitionMode } from './acquisition-mode';
import type { Acquired, AcquisitionMode, NativeOutput, ModeOptions } from './acquisition-mode';

/** Acquisition metadata appended by each val-box adapter stage. */
export type ValBoxFrame<M> = {
  /** Identifies this frame as val-box metadata. */
  readonly kind: 'val-box';
  /** The box snapshot's metadata presence record. */
  readonly metadata: Presence<M>;
  /** The copied alias, where an empty string remains distinct from `null`. */
  readonly alias: string | null;
};

type Mode = 'required' | 'presence';
type ValueOptions<M extends Mode, A extends AcquisitionMode> =
  | ({ readonly value: M } & ModeOptions<A, M extends 'presence' ? 'raw' : 'auto'>)
  | ('required' extends M ? { readonly value?: M; readonly acquisition: A } : never);
type Snapshot = { readonly value: Presence<unknown>; readonly metadata: Presence<unknown>; readonly alias: string | null };
type SnapshotBox = { snapshot: (...args: never[]) => Snapshot };
type SnapshotOf<B> = B extends { snapshot: (...args: never[]) => infer S } ? S : never;
type Payload<P> = P extends { readonly present: true; readonly value: infer V } ? V : never;
type Value<B> = SnapshotOf<B> extends { readonly value: infer V } ? Payload<V> : never;
type Metadata<B> = SnapshotOf<B> extends { readonly metadata: infer M } ? Payload<M> : never;
type Output<B, M extends Mode> = M extends 'presence' ? Presence<Value<B>> : Value<B>;
type Frames<R extends Registration, B> = readonly [...ProviderAcquisitionMetadata<R>, ValBoxFrame<Metadata<B>>];
type InvalidSnapshot<B> = B extends { snapshot: infer C }
  ? C extends (...args: never[]) => Snapshot ? [] extends Parameters<C> ? B extends ThisParameterType<C> ? never : true : true : true : true;
type Valid<B> = [InvalidSnapshot<B>] extends [never] ? unknown : Unsatisfied<'invalid val-box snapshot capability', {}>;
type Adapted<R extends Registration, B, M extends Mode, O = Output<B, M>, A extends AcquisitionMode = 'auto'> = Provider<(this: void, deps: ProviderNeeds<R>) => O, RetainedMetadata<R>, Frames<R, B>, ProviderGraph<R>, Acquired<O, A>>;

/**
 * Snapshot an immediate structural val-box once and require a present value.
 * @param registration - A registration exposing a receiver-bound, zero-argument `snapshot()` method.
 * @returns A provider exposing the snapshot value and appending a {@link ValBoxFrame}.
 * @throws If the box or snapshot is malformed, or the value is absent.
 */
export function fromValBox<R extends Registration>(registration: R & Registration & Valid<ProviderOutput<NoInfer<R>>>): Adapted<R, ProviderOutput<R>, 'required'>;
/**
 * Snapshot an immediate structural val-box once with explicit value and acquisition semantics.
 * @param registration - A registration exposing the structural snapshot capability.
 * @param options - Select required value or presence; required mode may also select acquisition.
 * @returns A provider exposing the value or its {@link Presence} record with an appended frame.
 * @throws If options, capability, snapshot, or required-value presence are invalid.
 */
export function fromValBox<R extends Registration, M extends Mode = 'required', A extends AcquisitionMode = M extends 'presence' ? 'raw' : 'auto'>(registration: R & Registration & Valid<ProviderOutput<NoInfer<R>>>, options: { readonly value?: M } & ValueOptions<M, A> & NativeOutput<Output<ProviderOutput<NoInfer<R>>, NoInfer<M>>, NoInfer<A>>): Adapted<R, ProviderOutput<R>, M, Output<ProviderOutput<R>, M>, A>;
export function fromValBox(registration: Registration, options?: { readonly value?: Mode; readonly acquisition?: AcquisitionMode }): unknown {
  return adapt(registration, options, false);
}

/**
 * Await a structural val-box and its required snapshot value.
 * @param registration - A registration whose awaited output exposes `snapshot()`.
 * @returns A provider exposing a native Promise of the awaited present value.
 * @throws Asynchronously if the capability or snapshot is invalid, or the value is absent.
 */
export function fromValBoxAsync<R extends Registration>(registration: R & Registration & Valid<Awaited<ProviderOutput<NoInfer<R>>>>): Adapted<R, Awaited<ProviderOutput<R>>, 'required', Promise<Awaited<Value<Awaited<ProviderOutput<R>>>>>>;
/**
 * Await a structural val-box and select required-value or presence output.
 * @param registration - A registration whose awaited output exposes `snapshot()`.
 * @param options - Required value-selection mode; async adaptation has no acquisition option.
 * @returns A provider exposing a native Promise of the awaited value or presence record.
 * @throws Asynchronously if the capability, snapshot, or required-value presence is invalid.
 */
export function fromValBoxAsync<R extends Registration, M extends Mode>(registration: R & Registration & Valid<Awaited<ProviderOutput<NoInfer<R>>>>, options: { readonly value: M }): Adapted<R, Awaited<ProviderOutput<R>>, M, Promise<Awaited<Output<Awaited<ProviderOutput<R>>, M>>>>;
export function fromValBoxAsync(registration: Registration, options?: { readonly value: Mode }): unknown {
  return adapt(registration, options, true);
}

function adapt<R extends Registration>(registration: R, options: { readonly value?: Mode; readonly acquisition?: AcquisitionMode } | undefined, async: boolean): Adapted<R, SnapshotBox, Mode> {
  if (options !== undefined && (options === null || typeof options !== 'object')) throw new Error('invalid val-box value options');
  const selected = options?.value;
  if (options !== undefined && selected === undefined && (async || !('acquisition' in options))) throw new Error('val-box options require a value selection');
  const mode = selected === undefined ? 'required' : selected;
  if (mode !== 'required' && mode !== 'presence') throw new Error('invalid val-box value mode');
  const acquisition = async ? 'native' : acquisitionMode(options, mode === 'presence' ? 'raw' : 'auto');
  if (!async && mode === 'presence' && acquisition === 'native') throw new Error('native acquisition is invalid for val-box presence');
  return transform<R, (this: void, deps: ProviderNeeds<R>) => unknown, Frames<R, SnapshotBox>>(registration, {
    kind: async ? 'frame-async' : 'frame-sync',
    acquisition: async ? 'native' : acquisition,
    project(box: unknown) {
      if (box === null || (typeof box !== 'object' && typeof box !== 'function')) throw new Error('invalid val-box snapshot capability');
      const method: unknown = Reflect.get(box, 'snapshot');
      if (typeof method !== 'function') throw new Error('invalid val-box snapshot capability');
      const snapshot: unknown = Reflect.apply(method, box, []);
      if (!record(snapshot)) throw new Error('invalid val-box snapshot');
      const value = copyPresence(snapshot.value);
      const metadata = copyPresence(snapshot.metadata);
      const alias = snapshot.alias;
      if (alias !== null && typeof alias !== 'string') throw new Error('invalid val-box snapshot alias');
      const frame = Object.freeze({ kind: 'val-box' as const, metadata, alias });
      if (mode === 'presence') return { value, frame };
      if (!value.present) throw new Error('val-box value is absent');
      return { value: value.value, frame };
    },
  });
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function copyPresence(value: unknown): Presence<unknown> {
  if (!record(value)) throw new Error('invalid val-box snapshot presence');
  const present = value.present;
  if (present === false) return Object.freeze({ present: false });
  if (present !== true || !('value' in value)) throw new Error('invalid val-box snapshot presence');
  return Object.freeze({ present: true, value: value.value });
}
