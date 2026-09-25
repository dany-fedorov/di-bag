import { libraryError, libraryTypeError } from './errors';
import type { Factory, ProviderOrFactory } from './registration';
import type { Unsatisfied } from './types';
import { describe, retainDescription, sourceDescription } from './provider-operations';
import type { ProviderOperation } from './provider-operations';
import { readTokenKey } from './tokens';
import type { CollectionTokenBase, TokenBase, TokenKey, TokenService } from './tokens';
import type { GraphContract, TokenDependencyContract, OpaqueGraph, TokenTupleAdmission, ReboundGraph } from './token-types';
import type { FactoryReturnKind, NativeOutput, SyncOutput } from './acquisition-mode';
import { factoryReturnKind } from './acquisition-mode';
import { snapshotOptionsBag } from './options-bag';

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
 * Create providers through {@link DiBagApi.createProvider}, composition adapters, or provider
 * composition facades. This type-only class has no public constructor or instance methods.
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

export type MappedProviderFactory<ExposedFactory extends Factory, Output> =
  Parameters<ExposedFactory> extends []
    ? (this: void) => Output
    : (this: void, dependencies: Exclude<Parameters<ExposedFactory>[0], undefined>) => Output;

type TransformReturnAdmission<Output, ReturnKind extends FactoryReturnKind> =
  NativeOutput<Output, NoInfer<ReturnKind>> & SyncOutput<Output, NoInfer<ReturnKind>>;
export type CheckedTransformReturnKindOptions<Output, ReturnKind extends FactoryReturnKind> =
  'auto-detect' extends ReturnKind
    ? unknown extends TransformReturnAdmission<Output, ReturnKind>
      ? { readonly transformReturnKind?: ReturnKind & TransformReturnAdmission<Output, ReturnKind> }
      : { readonly transformReturnKind: ReturnKind & TransformReturnAdmission<Output, ReturnKind> }
    : { readonly transformReturnKind: ReturnKind & TransformReturnAdmission<Output, ReturnKind> };

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
 * Extract the callable factory contract retained by a provider.
 * @see https://dany-fedorov.github.io/di-bag/guides/api-reference.html#provider-and-module-projections
 */
export type ProviderFactory<R extends ProviderOrFactory> = R extends infer T & {} ? FactoryOf<T> : never;
type FactoryOf<R> = R extends Factory ? R
  : R extends ProviderContext<infer F> ? F
    : R extends ProviderBase ? (this: void, dependencies: unknown) => unknown : never;
// An erased provider cannot prove an output or dependency shape, including
// when mixed with concrete registrations behind a NoInfer boundary.
/**
 * Extract the exact service value exposed by a provider, including Promise identity.
 * @see https://dany-fedorov.github.io/di-bag/guides/api-reference.html#provider-and-module-projections
 */
export type ProviderOutput<R extends ProviderOrFactory> = ProviderBase extends R ? unknown : ReturnType<ProviderFactory<R>>;
/**
 * Extract the fulfilled or raw value passed to the provider's outer disposer.
 * @see https://dany-fedorov.github.io/di-bag/guides/api-reference.html#provider-and-module-projections
 */
export type ProviderAcquiredValue<R extends ProviderOrFactory> = ProviderBase extends R ? unknown
  : R extends infer T & {} ? AcquiredOf<T> : unknown;
type AcquiredOf<R> = R extends { readonly [providerInvariant]: (...args: never[]) => [Factory, object, readonly unknown[], GraphContract, infer V] } ? V
  : R extends Factory ? Awaited<ReturnType<R>>
  : unknown;
/**
 * Extract the provider's named dependency object.
 * @see https://dany-fedorov.github.io/di-bag/guides/api-reference.html#provider-and-module-projections
 */
export type ProviderNamedDependencies<R extends ProviderOrFactory> = ProviderBase extends R ? unknown : Parameters<ProviderFactory<R>> extends [] ? Record<never, never>
  : Exclude<Parameters<ProviderFactory<R>>[0], undefined>;
/**
 * Extract static metadata attached to a provider.
 * @see https://dany-fedorov.github.io/di-bag/guides/api-reference.html#provider-and-module-projections
 */
export type ProviderRegistrationMetadata<R> = R extends infer T & {} ? MetadataOf<T> : unknown;
type MetadataOf<R> = R extends Provider<infer _F, infer M, infer _A, infer _G, infer _V> ? M
  : R extends Factory ? Readonly<{}> : unknown;
/**
 * Extract the ordered acquisition-frame metadata tuple exposed by inspection.
 * @see https://dany-fedorov.github.io/di-bag/guides/api-reference.html#provider-and-module-projections
 */
export type ProviderAcquisitionMetadata<R> = ProviderBase extends R ? readonly unknown[]
  : R extends infer T & {} ? AcquisitionMetadataOf<T> : readonly unknown[];
type AcquisitionMetadataOf<R> = R extends Provider<infer _F, infer _M, infer A, infer _G, infer _V> ? A
  : R extends Factory ? readonly [] : readonly unknown[];

/**
 * Extract the retained typed-token and lifetime graph contract.
 * @see https://dany-fedorov.github.io/di-bag/guides/api-reference.html#provider-and-module-projections
 */
export type ProviderGraphContract<R> = ProviderBase extends R ? OpaqueGraph
  : R extends infer T & {} ? GraphOf<T> : OpaqueGraph;
type GraphOf<R> = R extends Provider<infer _F, infer _M, infer _A, infer G, infer _V> ? G
  : R extends Factory ? TokenDependencyContract
    : R extends ProviderContext<Factory, infer G> ? G : OpaqueGraph;
type RequiredTokens<G> = G extends { readonly kind: 'tokens'; readonly required: infer T extends readonly TokenBase[] } ? T[number] : TokenBase;
type Bound<G> = G extends { readonly kind: 'tokens'; readonly bound: infer B extends TokenBase } ? B : TokenBase;
type OptionalTokens<G> = G extends { readonly kind: 'tokens'; readonly optional: infer O extends readonly TokenBase[] } ? O[number] : TokenBase;
type CollectionTokens<G> = G extends { readonly kind: 'tokens'; readonly collections: infer C extends readonly CollectionTokenBase[] } ? C[number] : never;
/**
 * Extract token collection requirements from a provider.
 * @see https://dany-fedorov.github.io/di-bag/guides/api-reference.html#provider-and-module-projections
 */
export type ProviderCollectionTokens<R> = ProviderGraphContract<R> extends infer G
  ? CollectionTokens<G>
  : never;
/**
 * Extract optional typed-token requirements from a provider.
 * @see https://dany-fedorov.github.io/di-bag/guides/api-reference.html#provider-and-module-projections
 */
export type ProviderOptionalTokens<R> = OptionalTokens<ProviderGraphContract<R>>;
/**
 * Extract required typed-token dependencies from a provider.
 * @see https://dany-fedorov.github.io/di-bag/guides/api-reference.html#provider-and-module-projections
 */
export type ProviderRequiredTokens<R> = RequiredTokens<ProviderGraphContract<R>>;
export type BoundToken<R> = Bound<ProviderGraphContract<R>>;

/** Bind a checked output without changing the reusable source's retained needs. */
export function withTokenBinding<T extends TokenBase, R extends ProviderOrFactory>(
  token: T & TokenTupleAdmission<readonly [T]>,
  registration: R & ProviderOrFactory & ([ProviderOutput<NoInfer<R>>] extends [TokenService<NoInfer<T>>] ? unknown
    : Unsatisfied<'token binding output is not assignable to its service', { token: TokenKey<T>; expected: TokenService<T>; provided: ProviderOutput<R> }>),
  operation = 'register',
): Provider<ProviderFactory<R>, RetainedMetadata<R>, ProviderAcquisitionMetadata<R>, ReboundGraph<ProviderGraphContract<R>, T>, ProviderAcquiredValue<R>> {
  readTokenKey(token);
  const handle = new Provider<ProviderFactory<R>, RetainedMetadata<R>, ProviderAcquisitionMetadata<R>, ReboundGraph<ProviderGraphContract<R>, T>, ProviderAcquiredValue<R>>();
  retainDescription(handle, describe(registration, operation));
  return handle;
}

type MappedFactory<R extends ProviderOrFactory, O> = (this: void, dependencies: ProviderNamedDependencies<R>) => O;
export type RetainedMetadata<R> = ProviderRegistrationMetadata<R> extends object ? ProviderRegistrationMetadata<R> : object;

/** Extend an authenticated description without exposing its operations. */
export function transform<R extends ProviderOrFactory, F extends Factory, A extends readonly unknown[] = ProviderAcquisitionMetadata<R>, V = Awaited<ReturnType<F>>>(registration: R, operation: ProviderOperation): Provider<F, RetainedMetadata<R>, A, ProviderGraphContract<R>, V> {
  const description = describe(registration);
  const handle = new Provider<F, RetainedMetadata<R>, A, ProviderGraphContract<R>, V>();
  retainDescription(handle, Object.freeze({ ...description, operations: Object.freeze([...description.operations, Object.freeze(operation)]) }));
  return handle;
}

export function addDisposal(provider: ProviderBase, disposeService: unknown, operation = 'withDisposal'): ProviderBase {
  if (typeof disposeService !== 'function') throw libraryTypeError('DI_BAG_INVALID_ARGUMENT', `${operation} disposeService must be a function`, { operation, argument: 'disposeService', expected: 'a function' });
  return transform(provider as ProviderOrFactory, { kind: 'owned', dispose: disposeService as (value: never) => void | Promise<void> });
}

export function addRegistrationMetadata(provider: ProviderBase, registrationMetadata: unknown, operation = 'withRegistrationMetadata'): ProviderBase {
  if (typeof registrationMetadata !== 'object' || registrationMetadata === null || Array.isArray(registrationMetadata)) throw libraryTypeError('DI_BAG_INVALID_ARGUMENT', `${operation} registrationMetadata must be an object`, { operation, argument: 'registrationMetadata', expected: 'an object' });
  const description = describe(provider);
  const keys = Reflect.ownKeys(registrationMetadata);
  for (const key of keys) if (Object.hasOwn(description.metadata, key)) throw libraryError('DI_BAG_DUPLICATE_METADATA_KEY', `duplicate registration metadata: ${String(key)}`, { operation, metadataKey: key });
  const added = Object.create(null) as Record<PropertyKey, unknown>;
  for (const key of keys) added[key] = Reflect.get(registrationMetadata, key);
  Object.freeze(added);
  const metadata = Object.freeze(Object.assign(Object.create(null), description.metadata, added));
  const handle = createProvider<Factory, object, readonly unknown[], GraphContract, unknown>();
  retainDescription(handle, Object.freeze({ ...description, operations: Object.freeze([...description.operations, Object.freeze({ kind: 'metadata' as const, metadata: added })]), metadata }));
  return handle;
}

export function addAcquisitionMetadata(provider: ProviderBase, options: unknown, operation: string): ProviderBase {
  const { describeAcquisition, callbackReceives } = snapshotOptionsBag(options, operation, ['describeAcquisition', 'callbackReceives']);
  if (typeof describeAcquisition !== 'function') throw libraryTypeError('DI_BAG_INVALID_ARGUMENT', `${operation} describeAcquisition must be a function`, { operation, argument: 'describeAcquisition', expected: 'a function' });
  if (callbackReceives !== 'exposed-service' && callbackReceives !== 'fulfilled-value') throw libraryTypeError('DI_BAG_INVALID_ARGUMENT', `${operation} callbackReceives must name the callback input`, { operation, argument: 'callbackReceives', expected: "one of: 'exposed-service', 'fulfilled-value'" });
  return annotate(provider as ProviderOrFactory, describeAcquisition as (value: never) => object, callbackReceives === 'fulfilled-value', operation);
}

export function addTransformedService(provider: ProviderBase, options: unknown, operation = 'withTransformedService'): ProviderBase {
  const bag = snapshotOptionsBag(options, operation, ['transformService', 'callbackReceives'], ['transformReturnKind']);
  const { transformService, callbackReceives, transformReturnKind } = bag;
  if (typeof transformService !== 'function') throw libraryTypeError('DI_BAG_INVALID_ARGUMENT', `${operation} transformService must be a function`, { operation, argument: 'transformService', expected: 'a function' });
  if (callbackReceives !== 'exposed-service' && callbackReceives !== 'fulfilled-value') throw libraryTypeError('DI_BAG_INVALID_ARGUMENT', `${operation} callbackReceives must name the callback input`, { operation, argument: 'callbackReceives', expected: "one of: 'exposed-service', 'fulfilled-value'" });
  if (callbackReceives === 'fulfilled-value' && Object.hasOwn(bag, 'transformReturnKind')) throw libraryTypeError('DI_BAG_INVALID_ARGUMENT', `${operation} transformReturnKind is absent for fulfilled-value callbacks`, { operation, argument: 'transformReturnKind', expected: "absent when callbackReceives is 'fulfilled-value'" });
  const selected = callbackReceives === 'fulfilled-value' ? 'native-promise' : factoryReturnKind(transformReturnKind, operation, 'auto-detect', 'transformReturnKind');
  return transform(provider as ProviderOrFactory, { kind: callbackReceives === 'fulfilled-value' ? 'map-async' : 'map-sync', project: transformService as (value: never) => unknown, factoryReturnKind: selected });
}

type InvalidAcquisitionMetadata<M> = M extends unknown
  ? M extends readonly unknown[] | ((...args: never[]) => unknown) ? true
    : 'then' extends keyof M
      ? unknown extends M['then'] ? true
        : Extract<M['then'], (...args: never[]) => unknown> extends never ? never : true
      : never
  : never;
export type AcquisitionMetadataAdmission<M> = [InvalidAcquisitionMetadata<M>] extends [never] ? unknown
  : Unsatisfied<'acquisition metadata must be a synchronous object record', {}>;
type AcquisitionFrames<R, M> = readonly [...ProviderAcquisitionMetadata<R>, Readonly<M>];

function annotate<R extends ProviderOrFactory, F extends Factory, M extends object, V>(registration: R, callback: (this: void, value: never) => object, async: boolean, operation: string): Provider<F, RetainedMetadata<R>, AcquisitionFrames<R, M>, ProviderGraphContract<R>, V> {
  if (typeof callback !== 'function') throw libraryTypeError('DI_BAG_INVALID_ARGUMENT', 'acquisition metadata requires a function', { operation, argument: 'describeAcquisition', expected: 'a function' });
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
        return invalidAcquisitionMetadata(metadata, operation);
      }
      const prototype = Object.getPrototypeOf(metadata);
      if (prototype !== null && prototype !== Object.prototype) return invalidAcquisitionMetadata(metadata, operation);
      const frame = Object.create(null) as Record<PropertyKey, unknown>;
      for (const key of Reflect.ownKeys(metadata)) frame[key] = Reflect.get(metadata, key);
      const then = Object.hasOwn(frame, 'then') ? frame.then : Reflect.get(metadata, 'then');
      if (typeof then === 'function') return invalidAcquisitionMetadata(metadata, operation);
      return { value, frame: Object.freeze(frame) };
    },
  });
}

function invalidAcquisitionMetadata(value: unknown, operation: string): never {
  // A widened callback can return a rejected Promise. Observe that invalid result
  // before throwing, without reading its `then` or assimilating service values.
  // The intrinsic rejects non-Promise receivers without invoking user code.
  try { Promise.prototype.then.call(value, () => {}, () => {}); } catch { /* Not an observable native Promise. */ }
  throw libraryTypeError('DI_BAG_INVALID_ACQUISITION_METADATA', 'acquisition metadata must be a synchronous plain object record', { operation });
}

export type MetadataKeyUnion<M> = M extends unknown ? keyof M : never;
type NonFiniteKeys<M> = M extends unknown ? {
  [K in keyof M]-?: Record<never, never> extends Record<K, never> ? K : never;
}[keyof M] : never;
export type MetadataKeys<R, M> = [NonFiniteKeys<M> | Extract<MetadataKeyUnion<M>, number>] extends [never]
  ? [MetadataKeyUnion<M> & MetadataKeyUnion<ProviderRegistrationMetadata<R>>] extends [never] ? unknown
    : Unsatisfied<'duplicate metadata keys', { duplicates: MetadataKeyUnion<M> & MetadataKeyUnion<ProviderRegistrationMetadata<R>> }>
  : Unsatisfied<'metadata keys must be finite string or unique-symbol keys', {}>;

export type { Provider, ProviderBase };
