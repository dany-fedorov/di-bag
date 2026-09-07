import type { DisposableFactory, Factory, Registration } from './registration';
import type { Unsatisfied } from './types';
import { describe, retainDescription, sourceDescription } from './provider-operations';
import type { ProviderOperation } from './provider-operations';
import { readTokenKey } from './tokens';
import { snapshotReferences } from './dependency-references';
import type { Dependency } from './dependency-references';
import type { TokenBase, TokenService } from './tokens';
import type { GraphContract, TokenGraph, OpaqueGraph, TokenTupleAdmission, TokenArguments, ReboundGraph, ReferenceGraph, DependencyTupleAdmission } from './token-types';
import { acquisitionMode } from './acquisition-mode';
import type { Acquired, AcquisitionMode, NativeOutput, StageOptions } from './acquisition-mode';

declare const providerInvariant: unique symbol;

// Non-generic admission preserves invariant concrete contracts at graph boundaries.
class ProviderBase {
  declare private readonly nominal: void;
}

class Provider<F extends Factory, M extends object = Readonly<{}>, A extends readonly unknown[] = readonly [], G extends GraphContract = TokenGraph, V = Awaited<ReturnType<F>>> extends ProviderBase {
  // Unlike an ordinary private field, this witness survives declaration emit.
  declare readonly [providerInvariant]: (value: [F, M, A, G, V]) => [F, M, A, G, V];
}

/** Internal construction bridge; authentication remains in retainDescription. */
export function createProvider<F extends Factory, M extends object, A extends readonly unknown[], G extends GraphContract, V>(): Provider<F, M, A, G, V> {
  return new Provider<F, M, A, G, V>();
}

// A covariant view of the retained witness supplies graph-compatible callable
// context without widening the actual provider's invariant F/M/A/G contracts.
export type ProviderContext<F extends Factory, G extends GraphContract = GraphContract> = ProviderBase & {
  readonly [providerInvariant]: (...args: never[]) => [F, object, readonly unknown[], G, unknown];
};

// Infer through an intersection before distributing. A bare infer preserves
// NoInfer's substitution wrapper, which tests heterogeneous unions as a whole
// and can miss every branch. Every registration is non-nullish.
export type ProviderFactory<R extends Registration> = R extends infer T & {} ? FactoryOf<T> : never;
type FactoryOf<R> = R extends Factory ? R
  : R extends { create: infer F extends Factory } ? F
    : R extends ProviderContext<infer F> ? F
      : R extends ProviderBase ? (this: void, deps: unknown) => unknown : never;
// An erased provider cannot prove an output or dependency shape, including
// when mixed with concrete registrations behind a NoInfer boundary.
export type ProviderOutput<R extends Registration> = ProviderBase extends R ? unknown : ReturnType<ProviderFactory<R>>;
export type ProviderAcquired<R extends Registration> = ProviderBase extends R ? unknown
  : R extends infer T & {} ? AcquiredOf<T> : unknown;
type AcquiredOf<R> = R extends { readonly [providerInvariant]: (...args: never[]) => [Factory, object, readonly unknown[], GraphContract, infer V] } ? V
  : R extends Factory ? Awaited<ReturnType<R>>
    : R extends DisposableFactory<infer F> ? Awaited<ReturnType<F>> : unknown;
export type ProviderNeeds<R extends Registration> = ProviderBase extends R ? unknown : Parameters<ProviderFactory<R>> extends [] ? Record<never, never>
  : Exclude<Parameters<ProviderFactory<R>>[0], undefined>;
export type ProviderMetadata<R> = R extends infer T & {} ? MetadataOf<T> : unknown;
type MetadataOf<R> = R extends Provider<infer _F, infer M, infer _A, infer _G, infer _V> ? M
  : R extends Factory | DisposableFactory<Factory> ? Readonly<{}> : unknown;
export type ProviderAcquisitionMetadata<R> = ProviderBase extends R ? readonly unknown[]
  : R extends infer T & {} ? AcquisitionMetadataOf<T> : readonly unknown[];
type AcquisitionMetadataOf<R> = R extends Provider<infer _F, infer _M, infer A, infer _G, infer _V> ? A
  : R extends Factory | DisposableFactory<Factory> ? readonly [] : readonly unknown[];

export type ProviderGraph<R> = ProviderBase extends R ? OpaqueGraph
  : R extends infer T & {} ? GraphOf<T> : OpaqueGraph;
type GraphOf<R> = R extends Provider<infer _F, infer _M, infer _A, infer G, infer _V> ? G
  : R extends Factory | DisposableFactory<Factory> ? TokenGraph
    : R extends ProviderContext<Factory, infer G> ? G : OpaqueGraph;
type RequiredTokens<G> = G extends TokenGraph<infer T, TokenBase, readonly TokenBase[]> ? T[number] : TokenBase;
type Bound<G> = G extends TokenGraph<readonly TokenBase[], infer B, readonly TokenBase[]> ? B : TokenBase;
type OptionalTokens<G> = G extends TokenGraph<readonly TokenBase[], TokenBase, infer O> ? O[number] : TokenBase;
export type ProviderOptionalTokenNeeds<R> = OptionalTokens<ProviderGraph<R>>;
export type ProviderTokenNeeds<R> = RequiredTokens<ProviderGraph<R>>;
export type BoundToken<R> = Bound<ProviderGraph<R>>;

/** Select declared token services as positional arguments without awaiting them. */
export function fromTokens<const T extends readonly Dependency[], F extends (this: void, ...args: TokenArguments<NoInfer<T>>) => ('native' extends M ? Promise<unknown> : unknown), M extends AcquisitionMode = 'auto'>(
  tokens: T & DependencyTupleAdmission<T>, callback: F,
  ...modeOptions: StageOptions<M>
): Provider<() => ReturnType<F>, Readonly<{}>, readonly [], ReferenceGraph<T>, Acquired<ReturnType<F>, M>>;
// Keep the legacy token-only diagnostic and reflected signature last.
export function fromTokens<const T extends readonly TokenBase[], F extends (this: void, ...args: TokenArguments<NoInfer<T>>) => ('native' extends M ? Promise<unknown> : unknown), M extends AcquisitionMode = 'auto'>(
  tokens: T & TokenTupleAdmission<T>, callback: F,
  ...modeOptions: StageOptions<M>
): Provider<() => ReturnType<F>, Readonly<{}>, readonly [], TokenGraph<T>, Acquired<ReturnType<F>, M>>;
export function fromTokens<const T extends readonly Dependency[], F extends (this: void, ...args: TokenArguments<NoInfer<T>>) => ('native' extends M ? Promise<unknown> : unknown), M extends AcquisitionMode = 'auto'>(
  tokens: T & DependencyTupleAdmission<T>, callback: F,
  ...modeOptions: StageOptions<M>
): Provider<() => ReturnType<F>, Readonly<{}>, readonly [], ReferenceGraph<T>, Acquired<ReturnType<F>, M>> {
  const acquisition = acquisitionMode(modeOptions[0]);
  const references = snapshotReferences(tokens);
  if (typeof callback !== 'function') throw new Error('token callback must be a function');
  const create = (deps: Record<symbol, unknown>) => {
    const args = references.map(reference => Reflect.get(deps, reference.slot));
    return Reflect.apply(callback, undefined, args);
  };
  const handle = new Provider<() => ReturnType<F>, Readonly<{}>, readonly [], ReferenceGraph<T>, Acquired<ReturnType<F>, M>>();
  retainDescription(handle, sourceDescription(create, undefined, references.map(reference => reference.key), acquisition, false, references));
  return handle;
}

/** Bind a checked output without changing the reusable source's retained needs. */
export function withTokenBinding<T extends TokenBase, R extends Registration>(
  token: T & TokenTupleAdmission<readonly [T]>,
  registration: R & Registration & ([ProviderOutput<NoInfer<R>>] extends [TokenService<NoInfer<T>>] ? unknown
    : Unsatisfied<'token binding output is not assignable to its service', {}>),
): Provider<ProviderFactory<R>, RetainedMetadata<R>, ProviderAcquisitionMetadata<R>, ReboundGraph<ProviderGraph<R>, T>, ProviderAcquired<R>> {
  readTokenKey(token);
  const handle = new Provider<ProviderFactory<R>, RetainedMetadata<R>, ProviderAcquisitionMetadata<R>, ReboundGraph<ProviderGraph<R>, T>, ProviderAcquired<R>>();
  retainDescription(handle, describe(registration));
  return handle;
}

type MappedFactory<R extends Registration, O> = (this: void, deps: ProviderNeeds<R>) => O;
export type RetainedMetadata<R> = ProviderMetadata<R> extends object ? ProviderMetadata<R> : object;

/** Extend an authenticated description without exposing its operations. */
export function transform<R extends Registration, F extends Factory, A extends readonly unknown[] = ProviderAcquisitionMetadata<R>, V = Awaited<ReturnType<F>>>(registration: R, operation: ProviderOperation): Provider<F, RetainedMetadata<R>, A, ProviderGraph<R>, V> {
  const description = describe(registration);
  const handle = new Provider<F, RetainedMetadata<R>, A, ProviderGraph<R>, V>();
  retainDescription(handle, Object.freeze({ ...description, operations: Object.freeze([...description.operations, Object.freeze(operation)]) }));
  return handle;
}

/** Project the exact source value without awaiting it or the projector result. */
export function mapSync<R extends Registration, P extends (this: void, value: ProviderOutput<NoInfer<R>>) => ('native' extends M ? Promise<unknown> : unknown), M extends AcquisitionMode = 'auto'>(
  registration: R & Registration,
  project: P,
  ...modeOptions: StageOptions<M>
): Provider<MappedFactory<R, ReturnType<P>>, RetainedMetadata<R>, ProviderAcquisitionMetadata<R>, ProviderGraph<R>, Acquired<ReturnType<P>, M>> {
  return transform<R, MappedFactory<R, ReturnType<P>>, ProviderAcquisitionMetadata<R>, Acquired<ReturnType<P>, M>>(registration, { kind: 'map-sync', project, acquisition: acquisitionMode(modeOptions[0]) });
}

/** Explicitly await the source and projector result; always expose a Promise. */
export function mapAsync<R extends Registration, P extends (this: void, value: Awaited<ProviderOutput<NoInfer<R>>>) => unknown>(
  registration: R & Registration,
  project: P,
): Provider<MappedFactory<R, Promise<Awaited<ReturnType<P>>>>, RetainedMetadata<R>, ProviderAcquisitionMetadata<R>, ProviderGraph<R>> {
  return transform<R, MappedFactory<R, Promise<Awaited<ReturnType<P>>>>>(registration, { kind: 'map-async', project, acquisition: 'native' });
}

export type MetadataKeyUnion<M> = M extends unknown ? keyof M : never;
type NonFiniteKeys<M> = M extends unknown ? {
  [K in keyof M]-?: Record<never, never> extends Record<K, never> ? K : never;
}[keyof M] : never;
type MetadataKeys<R, M> = [NonFiniteKeys<M> | Extract<MetadataKeyUnion<M>, number>] extends [never]
  ? [MetadataKeyUnion<M> & MetadataKeyUnion<ProviderMetadata<R>>] extends [never] ? unknown
    : Unsatisfied<'duplicate metadata keys', { duplicates: MetadataKeyUnion<M> & MetadataKeyUnion<ProviderMetadata<R>> }>
  : Unsatisfied<'metadata keys must be finite string or unique-symbol keys', {}>;

/** Add static metadata without evaluating the factory or transferring ownership. */
export function withMetadata<R extends Registration, M extends object>(
  registration: R & Registration,
  metadata: M & MetadataKeys<NoInfer<R>, M>,
): Provider<ProviderFactory<R>, Readonly<ProviderMetadata<R> & M>, ProviderAcquisitionMetadata<R>, ProviderGraph<R>, ProviderAcquired<R>> {
  const description = describe(registration);
  if (typeof metadata !== 'object' || metadata === null || Array.isArray(metadata)) {
    throw new Error('metadata must be a string or symbol-keyed object');
  }
  const keys = Reflect.ownKeys(metadata);
  for (const key of keys) {
    if (Object.hasOwn(description.metadata, key)) throw new Error(`duplicate metadata: ${String(key)}`);
  }
  // Preflight all keys before evaluating a getter; copy hidden entries as data too.
  const added = Object.create(null) as Record<PropertyKey, unknown>;
  for (const key of keys) added[key] = Reflect.get(metadata, key);
  Object.freeze(added);
  const combined = Object.freeze(Object.assign(Object.create(null), description.metadata, added));
  const handle = new Provider<ProviderFactory<R>, Readonly<ProviderMetadata<R> & M>, ProviderAcquisitionMetadata<R>, ProviderGraph<R>, ProviderAcquired<R>>();
  retainDescription(handle, Object.freeze({
    ...description,
    operations: Object.freeze([...description.operations, Object.freeze({ kind: 'metadata' as const, metadata: added })]),
    metadata: combined,
  }));
  return handle;
}

export type { Provider, ProviderBase };

/** Select source acquisition semantics without transferring ownership. */
export function factory<F extends Factory, M extends AcquisitionMode>(create: F,
  options: { readonly acquisition: M } & NativeOutput<ReturnType<NoInfer<F>>, NoInfer<M>>,
): Provider<F, Readonly<{}>, readonly [], TokenGraph, Acquired<ReturnType<F>, M>> {
  if (typeof create !== 'function') throw new Error('factory requires a function');
  if (options === undefined || options === null) throw new Error('factory requires an acquisition mode');
  const { acquisition } = options;
  if (acquisition === undefined) throw new Error('factory requires an acquisition mode');
  const mode = acquisitionMode({ acquisition });
  const handle = new Provider<F, Readonly<{}>, readonly [], TokenGraph, Acquired<ReturnType<F>, M>>();
  retainDescription(handle, sourceDescription(create, undefined, [], mode));
  return handle;
}
