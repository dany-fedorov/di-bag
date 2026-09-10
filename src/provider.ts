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

// Capture the output so synthetic factories do not repeatedly expand callback types.
type OutputFactory<O> = () => O;

declare const providerInvariant: unique symbol;

// Non-generic admission preserves invariant concrete contracts at graph boundaries.
/** A type-only common contract for immutable provider descriptions. */
class ProviderBase {
  declare private readonly nominal: void;
}

/**
 * An immutable provider description retaining factory, metadata, inspection-frame,
 * dependency-graph, and acquired-value contracts.
 *
 * Create providers through {@link Facade.factory}, composition adapters, or provider
 * decorators. This type-only class has no public constructor.
 */
class Provider<F extends Factory, M extends object = Readonly<{}>, A extends readonly unknown[] = readonly [], G extends GraphContract = TokenGraph, V = Awaited<ReturnType<F>>> extends ProviderBase {
  // Unlike an ordinary private field, this witness survives declaration emit.
  /** @internal */
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
/** Extract the callable factory contract retained by a registration. */
export type ProviderFactory<R extends Registration> = R extends infer T & {} ? FactoryOf<T> : never;
type FactoryOf<R> = R extends Factory ? R
  : R extends { create: infer F extends Factory } ? F
    : R extends ProviderContext<infer F> ? F
      : R extends ProviderBase ? (this: void, deps: unknown) => unknown : never;
// An erased provider cannot prove an output or dependency shape, including
// when mixed with concrete registrations behind a NoInfer boundary.
/** Extract the exact service value exposed by a registration, including Promise identity. */
export type ProviderOutput<R extends Registration> = ProviderBase extends R ? unknown : ReturnType<ProviderFactory<R>>;
/** Extract the fulfilled or raw value passed to the registration's outer disposer. */
export type ProviderAcquired<R extends Registration> = ProviderBase extends R ? unknown
  : R extends infer T & {} ? AcquiredOf<T> : unknown;
type AcquiredOf<R> = R extends { readonly [providerInvariant]: (...args: never[]) => [Factory, object, readonly unknown[], GraphContract, infer V] } ? V
  : R extends Factory ? Awaited<ReturnType<R>>
    : R extends DisposableFactory<infer F> ? Awaited<ReturnType<F>> : unknown;
/** Extract the registration's named dependency object. */
export type ProviderNeeds<R extends Registration> = ProviderBase extends R ? unknown : Parameters<ProviderFactory<R>> extends [] ? Record<never, never>
  : Exclude<Parameters<ProviderFactory<R>>[0], undefined>;
/** Extract static metadata attached to a registration. */
export type ProviderMetadata<R> = R extends infer T & {} ? MetadataOf<T> : unknown;
type MetadataOf<R> = R extends Provider<infer _F, infer M, infer _A, infer _G, infer _V> ? M
  : R extends Factory | DisposableFactory<Factory> ? Readonly<{}> : unknown;
/** Extract the ordered acquisition-frame metadata tuple exposed by inspection. */
export type ProviderAcquisitionMetadata<R> = ProviderBase extends R ? readonly unknown[]
  : R extends infer T & {} ? AcquisitionMetadataOf<T> : readonly unknown[];
type AcquisitionMetadataOf<R> = R extends Provider<infer _F, infer _M, infer A, infer _G, infer _V> ? A
  : R extends Factory | DisposableFactory<Factory> ? readonly [] : readonly unknown[];

/** Extract the retained typed-token and lifetime graph contract. */
export type ProviderGraph<R> = ProviderBase extends R ? OpaqueGraph
  : R extends infer T & {} ? GraphOf<T> : OpaqueGraph;
type GraphOf<R> = R extends Provider<infer _F, infer _M, infer _A, infer G, infer _V> ? G
  : R extends Factory | DisposableFactory<Factory> ? TokenGraph
    : R extends ProviderContext<Factory, infer G> ? G : OpaqueGraph;
type RequiredTokens<G> = G extends TokenGraph<infer T, TokenBase, readonly TokenBase[]> ? T[number] : TokenBase;
type Bound<G> = G extends TokenGraph<readonly TokenBase[], infer B, readonly TokenBase[]> ? B : TokenBase;
type OptionalTokens<G> = G extends TokenGraph<readonly TokenBase[], TokenBase, infer O> ? O[number] : TokenBase;
/** Extract token collection requirements from a registration. */
export type ProviderAllTokenNeeds<R> = ProviderGraph<R> extends infer G ? G extends { readonly all: infer T extends readonly TokenBase[] } ? T[number] : never : never;
/** Extract optional typed-token requirements from a registration. */
export type ProviderOptionalTokenNeeds<R> = OptionalTokens<ProviderGraph<R>>;
/** Extract required typed-token dependencies from a registration. */
export type ProviderTokenNeeds<R> = RequiredTokens<ProviderGraph<R>>;
export type BoundToken<R> = Bound<ProviderGraph<R>>;

/**
 * Inject declared token services and dependency references into a callback in tuple order.
 * Arguments and the callback result are not implicitly awaited; the new output stage uses
 * `auto` acquisition unless an explicit mode is supplied.
 * @param tokens - A finite tuple of tokens, optional/lazy references, or collection references.
 * @param callback - A receiver-free function called once per provider acquisition.
 * @param modeOptions - Optional acquisition mode for the callback result.
 * @returns An immutable provider description; no callback runs until resolution.
 * @typeParam F - The exact callback signature and return type retained by the provider.
 */
export function fromTokens<const T extends readonly Dependency[], F extends (this: void, ...args: TokenArguments<NoInfer<T>>) => ('native' extends M ? Promise<unknown> : unknown), M extends AcquisitionMode = 'auto'>(
  tokens: T & DependencyTupleAdmission<T>, callback: F,
  ...modeOptions: StageOptions<M>
): Provider<OutputFactory<ReturnType<F>>, Readonly<{}>, readonly [], ReferenceGraph<T>, Acquired<ReturnType<F>, M>>;
/**
 * Inject a tuple of required typed-token services into a callback without awaiting them.
 * @param tokens - A finite tuple of genuine typed tokens.
 * @param callback - A receiver-free callback whose parameters follow token order.
 * @param modeOptions - Optional acquisition mode for the callback result.
 * @returns A reusable provider that retains the declared token requirements.
 * @typeParam F - The exact callback signature and return type retained by the provider.
 */
// Keep the legacy token-only diagnostic and reflected signature last.
export function fromTokens<const T extends readonly TokenBase[], F extends (this: void, ...args: TokenArguments<NoInfer<T>>) => ('native' extends M ? Promise<unknown> : unknown), M extends AcquisitionMode = 'auto'>(
  tokens: T & TokenTupleAdmission<T>, callback: F,
  ...modeOptions: StageOptions<M>
): Provider<OutputFactory<ReturnType<F>>, Readonly<{}>, readonly [], TokenGraph<T>, Acquired<ReturnType<F>, M>>;
export function fromTokens<const T extends readonly Dependency[], F extends (this: void, ...args: TokenArguments<NoInfer<T>>) => ('native' extends M ? Promise<unknown> : unknown), M extends AcquisitionMode = 'auto'>(
  tokens: T & DependencyTupleAdmission<T>, callback: F,
  ...modeOptions: StageOptions<M>
): Provider<OutputFactory<ReturnType<F>>, Readonly<{}>, readonly [], ReferenceGraph<T>, Acquired<ReturnType<F>, M>> {
  const acquisition = acquisitionMode(modeOptions[0]);
  const references = snapshotReferences(tokens);
  if (typeof callback !== 'function') throw new Error('token callback must be a function');
  const create = (deps: Record<symbol, unknown>) => {
    const args = references.map(reference => Reflect.get(deps, reference.slot));
    return Reflect.apply(callback, undefined, args);
  };
  const handle = new Provider<OutputFactory<ReturnType<F>>, Readonly<{}>, readonly [], ReferenceGraph<T>, Acquired<ReturnType<F>, M>>();
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

/**
 * Project a registration's exact source value without awaiting either stage.
 * Dependencies, metadata, earlier ownership stages, and lifetime policy are retained;
 * mapping itself does not transfer ownership.
 * @param registration - The source factory, owned factory, or provider.
 * @param project - A receiver-free projector called with the exact exposed source value.
 * @param modeOptions - Optional acquisition mode for the projected result.
 * @returns A reusable provider exposing the projector's exact return value.
 * @typeParam P - The exact synchronous projector signature retained by the provider.
 */
export function mapSync<R extends Registration, P extends (this: void, value: ProviderOutput<NoInfer<R>>) => ('native' extends M ? Promise<unknown> : unknown), M extends AcquisitionMode = 'auto'>(
  registration: R & Registration,
  project: P,
  ...modeOptions: StageOptions<M>
): Provider<MappedFactory<R, ReturnType<P>>, RetainedMetadata<R>, ProviderAcquisitionMetadata<R>, ProviderGraph<R>, Acquired<ReturnType<P>, M>> {
  return transform<R, MappedFactory<R, ReturnType<P>>, ProviderAcquisitionMetadata<R>, Acquired<ReturnType<P>, M>>(registration, { kind: 'map-sync', project, acquisition: acquisitionMode(modeOptions[0]) });
}

/**
 * Await a registration's source and projector result through an explicit async boundary.
 * Dependencies, metadata, earlier ownership stages, and lifetime policy are retained.
 * @param registration - The source factory, owned factory, or provider.
 * @param project - A receiver-free projector receiving the awaited source value.
 * @returns A provider exposing a native Promise of the awaited projection.
 * @typeParam P - The exact asynchronous-boundary projector signature retained by the provider.
 */
export function mapAsync<R extends Registration, P extends (this: void, value: Awaited<ProviderOutput<NoInfer<R>>>) => unknown>(
  registration: R & Registration,
  project: P,
): Provider<MappedFactory<R, Promise<Awaited<ReturnType<P>>>>, RetainedMetadata<R>, ProviderAcquisitionMetadata<R>, ProviderGraph<R>> {
  return transform<R, MappedFactory<R, Promise<Awaited<ReturnType<P>>>>>(registration, { kind: 'map-async', project, acquisition: 'native' });
}

type InvalidAcquisitionMetadata<M> = M extends unknown
  ? M extends readonly unknown[] | ((...args: never[]) => unknown) ? true
    : 'then' extends keyof M
      ? unknown extends M['then'] ? true
        : Extract<M['then'], (...args: never[]) => unknown> extends never ? never : true
      : never
  : never;
type AcquisitionMetadataAdmission<M> = [InvalidAcquisitionMetadata<M>] extends [never] ? unknown
  : Unsatisfied<'acquisition metadata must be a synchronous object record', {}>;
type AcquisitionFrames<R, M> = readonly [...ProviderAcquisitionMetadata<R>, Readonly<M>];

/**
 * Describe the exact source output with acquisition-local metadata, without awaiting it.
 * Retains the source value identity, acquisition mode, dependencies, lifetime, and ownership.
 * @param registration - The source registration to describe.
 * @param describe - A receiver-free synchronous callback returning a plain object record.
 * @returns A provider appending a shallowly copied and frozen metadata frame per acquisition.
 * @typeParam P - The exact synchronous metadata callback signature retained by the provider.
 * @throws If the callback or its returned record is invalid, or annotation fails.
 */
export function withAcquisitionMetadata<R extends Registration, P extends (this: void, value: ProviderOutput<NoInfer<R>>) => object>(
  registration: R & Registration,
  describe: P & AcquisitionMetadataAdmission<ReturnType<P>>,
): Provider<ProviderFactory<R>, RetainedMetadata<R>, AcquisitionFrames<R, ReturnType<P>>, ProviderGraph<R>, ProviderAcquired<R>> {
  return annotate<R, ProviderFactory<R>, ReturnType<P>, ProviderAcquired<R>>(registration, describe, false);
}

/**
 * Await the source and describe its fulfilled value with acquisition-local metadata.
 * Dependencies, lifetime, and existing ownership are retained; annotation adds no ownership.
 * @param registration - The source registration to await and describe.
 * @param describe - A receiver-free synchronous callback returning a plain object record.
 * @returns A provider exposing a native Promise of the source value and appending a frozen frame.
 * @typeParam P - The exact synchronous metadata callback signature retained by the provider.
 * @throws If the callback is invalid; source and annotation failures reject asynchronously.
 */
export function withAcquisitionMetadataAsync<R extends Registration, P extends (this: void, value: Awaited<ProviderOutput<NoInfer<R>>>) => object>(
  registration: R & Registration,
  describe: P & AcquisitionMetadataAdmission<ReturnType<P>>,
): Provider<MappedFactory<R, Promise<Awaited<ProviderOutput<R>>>>, RetainedMetadata<R>, AcquisitionFrames<R, ReturnType<P>>, ProviderGraph<R>, Awaited<ProviderOutput<R>>> {
  return annotate<R, MappedFactory<R, Promise<Awaited<ProviderOutput<R>>>>, ReturnType<P>, Awaited<ProviderOutput<R>>>(registration, describe, true);
}

function annotate<R extends Registration, F extends Factory, M extends object, V>(registration: R, callback: (this: void, value: never) => object, async: boolean): Provider<F, RetainedMetadata<R>, AcquisitionFrames<R, M>, ProviderGraph<R>, V> {
  if (typeof callback !== 'function') throw new TypeError('acquisition metadata requires a function');
  const description = describe(registration);
  // Decoration retains the current output stage's mode even across metadata and ownership.
  let acquisition = description.source.acquisition;
  for (const operation of description.operations) {
    if ('acquisition' in operation) acquisition = operation.acquisition;
  }
  return transform<R, F, AcquisitionFrames<R, M>, V>(registration, {
    kind: async ? 'frame-async' : 'frame-sync',
    acquisition: async ? 'native' : acquisition,
    project(value: never) {
      const metadata = callback(value);
      if (typeof metadata !== 'object' || metadata === null || Array.isArray(metadata)) {
        return invalidAcquisitionMetadata(metadata);
      }
      const prototype = Object.getPrototypeOf(metadata);
      if (prototype !== null && prototype !== Object.prototype) return invalidAcquisitionMetadata(metadata);
      const frame = Object.create(null) as Record<PropertyKey, unknown>;
      for (const key of Reflect.ownKeys(metadata)) frame[key] = Reflect.get(metadata, key);
      const then = Object.hasOwn(frame, 'then') ? frame.then : Reflect.get(metadata, 'then');
      if (typeof then === 'function') return invalidAcquisitionMetadata(metadata);
      return { value, frame: Object.freeze(frame) };
    },
  });
}

function invalidAcquisitionMetadata(value: unknown): never {
  // A widened callback can return a rejected Promise. Observe that invalid result
  // before throwing, without reading its `then` or assimilating service values.
  // The intrinsic rejects non-Promise receivers without invoking user code.
  try { Promise.prototype.then.call(value, () => {}, () => {}); } catch { /* Not an observable native Promise. */ }
  throw new TypeError('acquisition metadata must be a synchronous plain object record');
}

export type MetadataKeyUnion<M> = M extends unknown ? keyof M : never;
type NonFiniteKeys<M> = M extends unknown ? {
  [K in keyof M]-?: Record<never, never> extends Record<K, never> ? K : never;
}[keyof M] : never;
type MetadataKeys<R, M> = [NonFiniteKeys<M> | Extract<MetadataKeyUnion<M>, number>] extends [never]
  ? [MetadataKeyUnion<M> & MetadataKeyUnion<ProviderMetadata<R>>] extends [never] ? unknown
    : Unsatisfied<'duplicate metadata keys', { duplicates: MetadataKeyUnion<M> & MetadataKeyUnion<ProviderMetadata<R>> }>
  : Unsatisfied<'metadata keys must be finite string or unique-symbol keys', {}>;

/**
 * Attach static metadata without evaluating the registration or transferring ownership.
 * Own string and symbol keys are copied and frozen; payload objects keep their identity.
 * @param registration - The source registration to describe.
 * @param metadata - A finite, noncolliding metadata record.
 * @returns A provider retaining the source output, dependencies, frames, and ownership stages.
 * @throws If metadata is not an object or an own key duplicates existing metadata.
 */
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

/**
 * Describe a factory with explicit result acquisition semantics and no ownership transfer.
 * `raw` exposes the exact result, `native` observes Promise fulfillment, and `auto` uses
 * the facade's configured native-Promise predicate.
 * @param create - A receiver-free service factory.
 * @param options - The required acquisition mode for its result.
 * @returns An immutable provider description; the factory remains lazy and per-bag cached.
 * @throws If the factory or acquisition option is invalid.
 */
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
