import { libraryError, libraryTypeError } from './errors';
import type { FactoryWithDisposal, Factory, Registration } from './registration';
import type { Unsatisfied } from './types';
import { describe, retainDescription, sourceDescription } from './provider-operations';
import type { ProviderOperation } from './provider-operations';
import { readTokenKey } from './tokens';
import type { CollectionTokenBase, TokenBase, TokenKey, TokenService } from './tokens';
import type { GraphContract, TokenDependencyContract, OpaqueGraph, TokenTupleAdmission, ReboundGraph } from './token-types';
import { normalizeLegacyMode } from './acquisition-mode';
import type { Acquired, AcquisitionMode, FactoryReturnKind, NativeOutput, AutoOutput, SyncOutput } from './acquisition-mode';

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
 * Create providers through {@link DiBagApi.fromFactory}, composition adapters, or provider
 * decorators. This type-only class has no public constructor.
 * @typeParam ExposedFactory - The exact exposed factory signature, including named dependencies.
 * @typeParam RegistrationMetadata - Static registration metadata available before resolution.
 * @typeParam AcquisitionMetadataFrames - The ordered tuple of acquisition metadata frame payloads.
 * @typeParam RetainedGraphContract - The retained token, lifetime, and graph compatibility contract.
 * @typeParam AcquiredValue - The raw or fulfilled value supplied to an outer disposal stage.
 * @see https://dany-fedorov.github.io/di-bag/guides/api-reference.html#provider-and-module-projections
 */
class Provider<ExposedFactory extends Factory, RegistrationMetadata extends object = Readonly<{}>, AcquisitionMetadataFrames extends readonly unknown[] = readonly [], RetainedGraphContract extends GraphContract = TokenDependencyContract, AcquiredValue = Awaited<ReturnType<ExposedFactory>>> extends ProviderBase {
  // Unlike an ordinary private field, this witness survives declaration emit.
  /** @internal */
  declare readonly [providerInvariant]: (value: [ExposedFactory, RegistrationMetadata, AcquisitionMetadataFrames, RetainedGraphContract, AcquiredValue]) => [ExposedFactory, RegistrationMetadata, AcquisitionMetadataFrames, RetainedGraphContract, AcquiredValue];
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
/**
 * Extract the callable factory contract retained by a registration.
 * @see https://dany-fedorov.github.io/di-bag/guides/api-reference.html#provider-and-module-projections
 */
export type ProviderFactory<R extends Registration> = R extends infer T & {} ? FactoryOf<T> : never;
type FactoryOf<R> = R extends Factory ? R
  : R extends { create: infer F extends Factory } ? F
    : R extends ProviderContext<infer F> ? F
      : R extends ProviderBase ? (this: void, dependencies: unknown) => unknown : never;
// An erased provider cannot prove an output or dependency shape, including
// when mixed with concrete registrations behind a NoInfer boundary.
/**
 * Extract the exact service value exposed by a registration, including Promise identity.
 * @see https://dany-fedorov.github.io/di-bag/guides/api-reference.html#provider-and-module-projections
 */
export type ProviderOutput<R extends Registration> = ProviderBase extends R ? unknown : ReturnType<ProviderFactory<R>>;
/**
 * Extract the fulfilled or raw value passed to the registration's outer disposer.
 * @see https://dany-fedorov.github.io/di-bag/guides/api-reference.html#provider-and-module-projections
 */
export type ProviderAcquiredValue<R extends Registration> = ProviderBase extends R ? unknown
  : R extends infer T & {} ? AcquiredOf<T> : unknown;
type AcquiredOf<R> = R extends { readonly [providerInvariant]: (...args: never[]) => [Factory, object, readonly unknown[], GraphContract, infer V] } ? V
  : R extends Factory ? Awaited<ReturnType<R>>
    : R extends FactoryWithDisposal<infer F> ? Awaited<ReturnType<F>> : unknown;
/**
 * Extract the registration's named dependency object.
 * @see https://dany-fedorov.github.io/di-bag/guides/api-reference.html#provider-and-module-projections
 */
export type ProviderNamedDependencies<R extends Registration> = ProviderBase extends R ? unknown : Parameters<ProviderFactory<R>> extends [] ? Record<never, never>
  : Exclude<Parameters<ProviderFactory<R>>[0], undefined>;
/**
 * Extract static metadata attached to a registration.
 * @see https://dany-fedorov.github.io/di-bag/guides/api-reference.html#provider-and-module-projections
 */
export type ProviderRegistrationMetadata<R> = R extends infer T & {} ? MetadataOf<T> : unknown;
type MetadataOf<R> = R extends Provider<infer _F, infer M, infer _A, infer _G, infer _V> ? M
  : R extends Factory | FactoryWithDisposal<Factory> ? Readonly<{}> : unknown;
/**
 * Extract the ordered acquisition-frame metadata tuple exposed by inspection.
 * @see https://dany-fedorov.github.io/di-bag/guides/api-reference.html#provider-and-module-projections
 */
export type ProviderAcquisitionMetadata<R> = ProviderBase extends R ? readonly unknown[]
  : R extends infer T & {} ? AcquisitionMetadataOf<T> : readonly unknown[];
type AcquisitionMetadataOf<R> = R extends Provider<infer _F, infer _M, infer A, infer _G, infer _V> ? A
  : R extends Factory | FactoryWithDisposal<Factory> ? readonly [] : readonly unknown[];

/**
 * Extract the retained typed-token and lifetime graph contract.
 * @see https://dany-fedorov.github.io/di-bag/guides/api-reference.html#provider-and-module-projections
 */
export type ProviderGraphContract<R> = ProviderBase extends R ? OpaqueGraph
  : R extends infer T & {} ? GraphOf<T> : OpaqueGraph;
type GraphOf<R> = R extends Provider<infer _F, infer _M, infer _A, infer G, infer _V> ? G
  : R extends Factory | FactoryWithDisposal<Factory> ? TokenDependencyContract
    : R extends ProviderContext<Factory, infer G> ? G : OpaqueGraph;
type RequiredTokens<G> = G extends { readonly kind: 'tokens'; readonly required: infer T extends readonly TokenBase[] } ? T[number] : TokenBase;
type Bound<G> = G extends { readonly kind: 'tokens'; readonly bound: infer B extends TokenBase } ? B : TokenBase;
type OptionalTokens<G> = G extends { readonly kind: 'tokens'; readonly optional: infer O extends readonly TokenBase[] } ? O[number] : TokenBase;
type CollectionTokens<G> = G extends { readonly kind: 'tokens'; readonly collections: infer C extends readonly CollectionTokenBase[] } ? C[number] : never;
/**
 * Extract token collection requirements from a registration.
 * @see https://dany-fedorov.github.io/di-bag/guides/api-reference.html#provider-and-module-projections
 */
export type ProviderCollectionTokens<R> = ProviderGraphContract<R> extends infer G
  ? CollectionTokens<G>
  : never;
/**
 * Extract optional typed-token requirements from a registration.
 * @see https://dany-fedorov.github.io/di-bag/guides/api-reference.html#provider-and-module-projections
 */
export type ProviderOptionalTokens<R> = OptionalTokens<ProviderGraphContract<R>>;
/**
 * Extract required typed-token dependencies from a registration.
 * @see https://dany-fedorov.github.io/di-bag/guides/api-reference.html#provider-and-module-projections
 */
export type ProviderRequiredTokens<R> = RequiredTokens<ProviderGraphContract<R>>;
export type BoundToken<R> = Bound<ProviderGraphContract<R>>;

/** Bind a checked output without changing the reusable source's retained needs. */
export function withTokenBinding<T extends TokenBase, R extends Registration>(
  token: T & TokenTupleAdmission<readonly [T]>,
  registration: R & Registration & ([ProviderOutput<NoInfer<R>>] extends [TokenService<NoInfer<T>>] ? unknown
    : Unsatisfied<'token binding output is not assignable to its service', { token: TokenKey<T>; expected: TokenService<T>; provided: ProviderOutput<R> }>),
  operation = 'register',
): Provider<ProviderFactory<R>, RetainedMetadata<R>, ProviderAcquisitionMetadata<R>, ReboundGraph<ProviderGraphContract<R>, T>, ProviderAcquiredValue<R>> {
  readTokenKey(token);
  const handle = new Provider<ProviderFactory<R>, RetainedMetadata<R>, ProviderAcquisitionMetadata<R>, ReboundGraph<ProviderGraphContract<R>, T>, ProviderAcquiredValue<R>>();
  retainDescription(handle, describe(registration, operation));
  return handle;
}

type MappedFactory<R extends Registration, O> = (this: void, dependencies: ProviderNamedDependencies<R>) => O;
export type RetainedMetadata<R> = ProviderRegistrationMetadata<R> extends object ? ProviderRegistrationMetadata<R> : object;

/** Extend an authenticated description without exposing its operations. */
export function transform<R extends Registration, F extends Factory, A extends readonly unknown[] = ProviderAcquisitionMetadata<R>, V = Awaited<ReturnType<F>>>(registration: R, operation: ProviderOperation): Provider<F, RetainedMetadata<R>, A, ProviderGraphContract<R>, V> {
  const description = describe(registration);
  const handle = new Provider<F, RetainedMetadata<R>, A, ProviderGraphContract<R>, V>();
  retainDescription(handle, Object.freeze({ ...description, operations: Object.freeze([...description.operations, Object.freeze(operation)]) }));
  return handle;
}

/**
 * Transform the exact exposed service without awaiting the input or callback result.
 * Retains dependencies, lifetime, metadata, and earlier cleanup; the result adds no ownership.
 * @param registration - The source registration whose exact output is transformed.
 * @param options - Direct mode, a transform callback, and optional output acquisitionMode (auto by default).
 * @returns A provider exposing the callback's exact result, with the selected output acquisition policy.
 * @typeParam R - The source registration and its retained contracts.
 * @typeParam P - The exact transform callback signature and output.
 * @typeParam M - The result's auto, raw, or nativePromise acquisition policy.
 */
type ExpandReturnKind = FactoryReturnKind | AcquisitionMode;
type NormalizedReturnKind<ReturnKind extends ExpandReturnKind> = ReturnKind extends 'auto' ? 'auto-detect'
  : ReturnKind extends 'raw' ? 'uninspected' : ReturnKind extends 'nativePromise' ? 'native-promise' : ReturnKind;
type ExpandTransformOptions<ReturnKind extends ExpandReturnKind> =
  'auto-detect' extends NormalizedReturnKind<ReturnKind> ? { readonly acquisitionMode?: ReturnKind }
    : 'auto' extends ReturnKind ? { readonly acquisitionMode?: ReturnKind } : { readonly acquisitionMode: ReturnKind };
function expandTransformReturnKind(options: { readonly acquisitionMode?: ExpandReturnKind }): FactoryReturnKind {
  const selected = options.acquisitionMode ?? 'auto-detect';
  if (selected === 'auto' || selected === 'raw' || selected === 'nativePromise') return normalizeLegacyMode(selected);
  if (selected === 'auto-detect' || selected === 'sync-value' || selected === 'native-promise' || selected === 'uninspected') return selected;
  throw libraryError('DI_BAG_INVALID_ACQUISITION_MODE', 'invalid acquisitionMode: use auto, raw, nativePromise, auto-detect, sync-value, native-promise, or uninspected', { option: 'acquisitionMode' });
}
/**
 * Transform the exact exposed service without awaiting the input or callback result.
 * @typeParam ServiceRegistration - The source registration and retained contracts.
 * @typeParam Transform - The exact transform callback signature and output.
 * @typeParam ReturnKind - The result's acquisition policy.
 */
export function transformService<
  ServiceRegistration extends Registration,
  Transform extends (this: void, exposedService: ProviderOutput<NoInfer<ServiceRegistration>>) => ('native-promise' extends NormalizedReturnKind<ReturnKind> ? Promise<unknown> : unknown),
  ReturnKind extends ExpandReturnKind = 'auto-detect',
>(
  registration: ServiceRegistration & Registration,
  options: { readonly mode: 'direct'; readonly transform: Transform } & ExpandTransformOptions<ReturnKind>
    & NativeOutput<ReturnType<NoInfer<Transform>>, NormalizedReturnKind<NoInfer<ReturnKind>>>
    & AutoOutput<ReturnType<NoInfer<Transform>>, NormalizedReturnKind<NoInfer<ReturnKind>>>
    & SyncOutput<ReturnType<NoInfer<Transform>>, NormalizedReturnKind<NoInfer<ReturnKind>>>,
): Provider<MappedFactory<ServiceRegistration, ReturnType<Transform>>, RetainedMetadata<ServiceRegistration>, ProviderAcquisitionMetadata<ServiceRegistration>, ProviderGraphContract<ServiceRegistration>, Acquired<ReturnType<Transform>, NormalizedReturnKind<ReturnKind>>>;
/**
 * Await the input and adopt the transformed result into a native Promise stage.
 * Retains dependencies, lifetime, metadata, and existing cleanup; adds no result ownership.
 * @param registration - The source registration whose fulfilled value is transformed.
 * @param options - Awaited mode and a transform callback; acquisitionMode cannot be overridden.
 * @returns A provider exposing a Promise of the awaited transform result.
 * @typeParam R - The source registration and retained contracts.
 * @typeParam P - The callback signature; its result may itself be a Promise.
 */
export function transformService<R extends Registration, P extends (this: void, fulfilledValue: Awaited<ProviderOutput<NoInfer<R>>>) => unknown>(
  registration: R & Registration,
  options: { readonly mode: 'awaited'; readonly transform: P; readonly acquisitionMode?: never },
): Provider<MappedFactory<R, Promise<Awaited<ReturnType<P>>>>, RetainedMetadata<R>, ProviderAcquisitionMetadata<R>, ProviderGraphContract<R>>;
export function transformService(registration: Registration, options: { readonly mode: 'direct' | 'awaited'; readonly transform: (value: never) => unknown; readonly acquisitionMode?: ExpandReturnKind }): ProviderBase {
  if (typeof options !== 'object' || options === null || (options.mode !== 'direct' && options.mode !== 'awaited')) throw libraryTypeError('DI_BAG_INVALID_TRANSFORM', 'transformService mode must be direct or awaited', { operation: 'transformService' });
  if (typeof options.transform !== 'function') throw libraryTypeError('DI_BAG_INVALID_TRANSFORM', 'transformService requires a transform callback', { operation: 'transformService' });
  if (options.mode === 'awaited' && 'acquisitionMode' in options) throw libraryTypeError('DI_BAG_INVALID_TRANSFORM', 'transformService awaited mode does not accept acquisitionMode', { operation: 'transformService' });
  return transform(registration, { kind: options.mode === 'direct' ? 'map-sync' : 'map-async', project: options.transform, factoryReturnKind: options.mode === 'direct' ? expandTransformReturnKind(options) : 'native-promise' });
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

function annotate<R extends Registration, F extends Factory, M extends object, V>(registration: R, callback: (this: void, value: never) => object, async: boolean): Provider<F, RetainedMetadata<R>, AcquisitionFrames<R, M>, ProviderGraphContract<R>, V> {
  if (typeof callback !== 'function') throw libraryTypeError('DI_BAG_INVALID_METADATA', 'acquisition metadata requires a function', { operation: 'withMetadata' });
  const description = describe(registration);
  // Decoration retains the current output stage's mode even across metadata and ownership.
  let factoryReturnKind = description.source.factoryReturnKind;
  for (const operation of description.operations) {
    if ('factoryReturnKind' in operation) factoryReturnKind = operation.factoryReturnKind;
  }
  return transform<R, F, AcquisitionFrames<R, M>, V>(registration, {
    kind: async ? 'frame-async' : 'frame-sync',
    factoryReturnKind: async ? 'native-promise' : factoryReturnKind,
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
  throw libraryTypeError('DI_BAG_INVALID_METADATA', 'acquisition metadata must be a synchronous plain object record', { operation: 'withMetadata' });
}

export type MetadataKeyUnion<M> = M extends unknown ? keyof M : never;
type NonFiniteKeys<M> = M extends unknown ? {
  [K in keyof M]-?: Record<never, never> extends Record<K, never> ? K : never;
}[keyof M] : never;
type MetadataKeys<R, M> = [NonFiniteKeys<M> | Extract<MetadataKeyUnion<M>, number>] extends [never]
  ? [MetadataKeyUnion<M> & MetadataKeyUnion<ProviderRegistrationMetadata<R>>] extends [never] ? unknown
    : Unsatisfied<'duplicate metadata keys', { duplicates: MetadataKeyUnion<M> & MetadataKeyUnion<ProviderRegistrationMetadata<R>> }>
  : Unsatisfied<'metadata keys must be finite string or unique-symbol keys', {}>;

/**
 * Attach static metadata without evaluating the registration or transferring ownership.
 * Own string and symbol keys are copied and frozen; payload objects keep their identity.
 * @param registration - The source registration to describe.
 * @param metadata - A finite, noncolliding metadata record.
 * @returns A provider retaining the source output, dependencies, frames, and ownership stages.
 * @throws If metadata is not an object or an own key duplicates existing metadata.
 */
function attachStaticMetadata<R extends Registration, M extends object>(
  registration: R & Registration,
  metadata: M & MetadataKeys<NoInfer<R>, M>,
): Provider<ProviderFactory<R>, Readonly<ProviderRegistrationMetadata<R> & M>, ProviderAcquisitionMetadata<R>, ProviderGraphContract<R>, ProviderAcquiredValue<R>> {
  const description = describe(registration);
  if (typeof metadata !== 'object' || metadata === null || Array.isArray(metadata)) {
    throw libraryError('DI_BAG_INVALID_METADATA', 'metadata must be a string or symbol-keyed object', { operation: 'withMetadata' });
  }
  const keys = Reflect.ownKeys(metadata);
  for (const key of keys) {
    if (Object.hasOwn(description.metadata, key)) throw libraryError('DI_BAG_DUPLICATE_METADATA', `duplicate metadata: ${String(key)}`, { operation: 'withMetadata', key });
  }
  // Preflight all keys before evaluating a getter; copy hidden entries as data too.
  const added = Object.create(null) as Record<PropertyKey, unknown>;
  for (const key of keys) added[key] = Reflect.get(metadata, key);
  Object.freeze(added);
  const combined = Object.freeze(Object.assign(Object.create(null), description.metadata, added));
  const handle = new Provider<ProviderFactory<R>, Readonly<ProviderRegistrationMetadata<R> & M>, ProviderAcquisitionMetadata<R>, ProviderGraphContract<R>, ProviderAcquiredValue<R>>();
  retainDescription(handle, Object.freeze({
    ...description,
    operations: Object.freeze([...description.operations, Object.freeze({ kind: 'metadata' as const, metadata: added })]),
    metadata: combined,
  }));
  return handle;
}

export type { Provider, ProviderBase };


/**
 * Attach registration metadata without evaluating the source or changing ownership.
 * Own keys are copied and frozen; static key collisions reject before getters run.
 * @param registration - The source registration to describe.
 * @param options - A static record with finite noncolliding string or unique-symbol keys.
 * @returns A provider preserving exact output, acquisition policy, and ordered dynamic frames.
 * @typeParam R - The source registration and retained contracts.
 * @typeParam M - The additional static registration metadata record.
 */
export function withMetadata<R extends Registration, M extends object>(
  registration: R & Registration,
  options: { readonly static: M & MetadataKeys<NoInfer<R>, M>; readonly dynamic?: never },
): Provider<ProviderFactory<R>, Readonly<RetainedMetadata<R> & M>, ProviderAcquisitionMetadata<R>, ProviderGraphContract<R>, ProviderAcquiredValue<R>>;
/**
 * Describe the exact exposed service with a synchronous plain metadata record.
 * Direct mode preserves Promise identity and source acquisition policy, adding no ownership.
 * @param registration - The source registration whose exact output is described.
 * @param options - Required static metadata and mandatory direct dynamic mode with a synchronous describe callback.
 * @returns A provider with merged registration metadata and one appended acquisition metadata frame.
 * @typeParam R - The source registration and retained contracts.
 * @typeParam P - The synchronous describe callback and its record result.
 * @typeParam M - The required static metadata record.
 */
export function withMetadata<R extends Registration, P extends (this: void, exposedService: ProviderOutput<NoInfer<R>>) => object, M extends object = {}>(
  registration: R & Registration,
  options: { readonly static: M & MetadataKeys<NoInfer<R>, M>; readonly dynamic: { readonly mode: 'direct'; readonly describe: P & AcquisitionMetadataAdmission<ReturnType<P>> } },
): Provider<ProviderFactory<R>, Readonly<RetainedMetadata<R> & M>, AcquisitionFrames<R, ReturnType<P>>, ProviderGraphContract<R>, ProviderAcquiredValue<R>>;
/**
 * Describe the exact exposed service with a synchronous plain metadata record.
 * Direct mode preserves Promise identity and source acquisition policy, adding no ownership.
 * @param registration - The source registration whose exact output is described.
 * @param options - Optional static metadata and mandatory direct dynamic mode with a synchronous describe callback.
 * If the static level may be absent, its added keys remain optional in inspection.
 * @returns A provider with merged registration metadata and one appended acquisition metadata frame.
 * @typeParam R - The source registration and retained contracts.
 * @typeParam P - The synchronous describe callback and its record result.
 * @typeParam M - The optional static metadata record.
 */
export function withMetadata<R extends Registration, P extends (this: void, exposedService: ProviderOutput<NoInfer<R>>) => object, M extends object = {}>(
  registration: R & Registration,
  options: { readonly static?: M & MetadataKeys<NoInfer<R>, M>; readonly dynamic: { readonly mode: 'direct'; readonly describe: P & AcquisitionMetadataAdmission<ReturnType<P>> } },
): Provider<ProviderFactory<R>, Readonly<RetainedMetadata<R> & Partial<M>>, AcquisitionFrames<R, ReturnType<P>>, ProviderGraphContract<R>, ProviderAcquiredValue<R>>;
/**
 * Await the source and append a synchronous metadata record through a native Promise stage.
 * Existing ownership and metadata frames remain ordered; annotation adds no ownership.
 * @param registration - The source registration whose fulfilled value is described.
 * @param options - Required static metadata and mandatory awaited mode with a synchronous describe callback.
 * @returns A provider exposing a Promise of the source value with one appended metadata frame.
 * @typeParam R - The source registration and retained contracts.
 * @typeParam P - The synchronous describe callback and its record result.
 * @typeParam M - The required static metadata record.
 */
export function withMetadata<R extends Registration, P extends (this: void, fulfilledValue: Awaited<ProviderOutput<NoInfer<R>>>) => object, M extends object = {}>(
  registration: R & Registration,
  options: { readonly static: M & MetadataKeys<NoInfer<R>, M>; readonly dynamic: { readonly mode: 'awaited'; readonly describe: P & AcquisitionMetadataAdmission<ReturnType<P>> } },
): Provider<MappedFactory<R, Promise<Awaited<ProviderOutput<R>>>>, Readonly<RetainedMetadata<R> & M>, AcquisitionFrames<R, ReturnType<P>>, ProviderGraphContract<R>, Awaited<ProviderOutput<R>>>;
/**
 * Await the source and append a synchronous metadata record through a native Promise stage.
 * Existing ownership and metadata frames remain ordered; annotation adds no ownership.
 * @param registration - The source registration whose fulfilled value is described.
 * @param options - Optional static metadata and mandatory awaited mode with a synchronous describe callback.
 * If the static level may be absent, its added keys remain optional in inspection.
 * @returns A provider exposing a Promise of the source value with one appended metadata frame.
 * @typeParam R - The source registration and retained contracts.
 * @typeParam P - The synchronous describe callback and its record result.
 * @typeParam M - The optional static metadata record.
 */
export function withMetadata<R extends Registration, P extends (this: void, fulfilledValue: Awaited<ProviderOutput<NoInfer<R>>>) => object, M extends object = {}>(
  registration: R & Registration,
  options: { readonly static?: M & MetadataKeys<NoInfer<R>, M>; readonly dynamic: { readonly mode: 'awaited'; readonly describe: P & AcquisitionMetadataAdmission<ReturnType<P>> } },
): Provider<MappedFactory<R, Promise<Awaited<ProviderOutput<R>>>>, Readonly<RetainedMetadata<R> & Partial<M>>, AcquisitionFrames<R, ReturnType<P>>, ProviderGraphContract<R>, Awaited<ProviderOutput<R>>>;
export function withMetadata(registration: Registration, options: { readonly static?: object; readonly dynamic?: { readonly mode: 'direct' | 'awaited'; readonly describe: (value: never) => object } }): ProviderBase {
  if (typeof options !== 'object' || options === null || Array.isArray(options)) throw libraryTypeError('DI_BAG_INVALID_METADATA', 'withMetadata requires static or dynamic metadata', { operation: 'withMetadata' });
  const hasStatic = Object.hasOwn(options, 'static');
  const hasDynamic = Object.hasOwn(options, 'dynamic');
  if (!hasStatic && !hasDynamic) throw libraryTypeError('DI_BAG_INVALID_METADATA', 'withMetadata requires static or dynamic metadata', { operation: 'withMetadata' });
  if ((!hasStatic && 'static' in options) || (!hasDynamic && 'dynamic' in options)) throw libraryTypeError('DI_BAG_INVALID_METADATA', 'withMetadata static and dynamic options must be own properties', { operation: 'withMetadata' });
  // Snapshot every executed dynamic field once, before static metadata getters can
  // change it. A checked mode must be the same mode used to build the operation.
  let frame: { readonly mode: 'direct' | 'awaited'; readonly describe: (value: never) => object } | undefined;
  if (hasDynamic) {
    const dynamic = options.dynamic;
    if (typeof dynamic !== 'object' || dynamic === null) throw libraryTypeError('DI_BAG_INVALID_METADATA', 'withMetadata dynamic mode must be direct or awaited', { operation: 'withMetadata' });
    const mode = dynamic.mode;
    if (mode !== 'direct' && mode !== 'awaited') throw libraryTypeError('DI_BAG_INVALID_METADATA', 'withMetadata dynamic mode must be direct or awaited', { operation: 'withMetadata' });
    const callback = dynamic.describe;
    if (typeof callback !== 'function') throw libraryTypeError('DI_BAG_INVALID_METADATA', 'acquisition metadata requires a function', { operation: 'withMetadata' });
    frame = { mode, describe: callback };
  }
  let result: Registration = hasStatic ? attachStaticMetadata(registration, options.static as never) : registration;
  if (frame !== undefined) result = annotate(result, frame.describe, frame.mode === 'awaited');
  return result as ProviderBase;
}
