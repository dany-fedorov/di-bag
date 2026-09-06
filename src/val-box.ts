import { transform } from './provider';
import type { Provider, ProviderAcquisitionMetadata, ProviderNeeds, ProviderOutput, RetainedMetadata, ProviderGraph } from './provider';
import type { Presence } from './inspection';
import type { Registration } from './registration';
import type { Unsatisfied } from './types';

export type ValBoxFrame<M> = {
  readonly kind: 'val-box';
  readonly metadata: Presence<M>;
  readonly alias: string | null;
};

type Mode = 'required' | 'presence';
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
type Adapted<R extends Registration, B, M extends Mode, O = Output<B, M>> = Provider<(this: void, deps: ProviderNeeds<R>) => O, RetainedMetadata<R>, Frames<R, B>, ProviderGraph<R>>;

/** Snapshot an immediate box once; an absent required value throws. */
export function fromValBox<R extends Registration>(registration: R & Registration & Valid<ProviderOutput<NoInfer<R>>>): Adapted<R, ProviderOutput<R>, 'required'>;
export function fromValBox<R extends Registration, M extends Mode>(registration: R & Registration & Valid<ProviderOutput<NoInfer<R>>>, options: { readonly value: M }): Adapted<R, ProviderOutput<R>, M>;
export function fromValBox(registration: Registration, options?: { readonly value: Mode }): unknown {
  return adapt(registration, options, false);
}

/** Explicitly await the box and exposed value; always return a native Promise. */
export function fromValBoxAsync<R extends Registration>(registration: R & Registration & Valid<Awaited<ProviderOutput<NoInfer<R>>>>): Adapted<R, Awaited<ProviderOutput<R>>, 'required', Promise<Awaited<Value<Awaited<ProviderOutput<R>>>>>>;
export function fromValBoxAsync<R extends Registration, M extends Mode>(registration: R & Registration & Valid<Awaited<ProviderOutput<NoInfer<R>>>>, options: { readonly value: M }): Adapted<R, Awaited<ProviderOutput<R>>, M, Promise<Awaited<Output<Awaited<ProviderOutput<R>>, M>>>>;
export function fromValBoxAsync(registration: Registration, options?: { readonly value: Mode }): unknown {
  return adapt(registration, options, true);
}

function adapt<R extends Registration>(registration: R, options: { readonly value: Mode } | undefined, async: boolean): Adapted<R, SnapshotBox, Mode> {
  const mode = options === undefined ? 'required' : options.value;
  if (mode !== 'required' && mode !== 'presence') throw new Error('invalid val-box value mode');
  return transform<R, (this: void, deps: ProviderNeeds<R>) => unknown, Frames<R, SnapshotBox>>(registration, {
    kind: async ? 'frame-async' : 'frame-sync',
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
