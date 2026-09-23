import { libraryError } from './errors';
import { acquisitionMode, factoryReturnKind, normalizeLegacyMode } from './acquisition-mode';
import type { Acquired, AutoOutput, FactoryReturnKind, LegacyAcquired, AcquisitionMode, LegacyAutoOutput, LegacyNativeOutput, LegacyStageOptions, NativeOutput, ReturnKindOptions, SyncOutput } from './acquisition-mode';
import type { FactoryContext } from './acquisition-context';
import { createProvider } from './provider';
import type { Provider, ProviderBase } from './provider';
import { retainDescription, sourceDescription } from './provider-operations';
import { snapshotReferences } from './dependency-references';
import { snapshotOptionsBag } from './options-bag';
import type { DependencyReference } from './dependency-references';
import type { TokenArguments, ReferenceGraph, DependencyTupleAdmission } from './token-types';
import type { Unsatisfied } from './types';

// Capture synthetic outputs independently of the retained callback type.
type OutputFactory<O> = () => O;

/**
 * Admit only a callable parameter tuple that can receive the selected dependency values.
 * @typeParam Supplied - Values obtained from the dependency tuple.
 * @typeParam Parameters_ - The callable's declared parameters.
 */
export type PositionalFactoryArguments<
  Supplied extends readonly unknown[],
  Parameters_ extends readonly unknown[],
> = [Supplied] extends [Parameters_]
  ? unknown
  : Unsatisfied<'positional factory arguments must match the declared parameter tuple', { supplied: Supplied; parameters: Parameters_ }>;

type FactoryContextArguments<ReceivesContext extends boolean> =
  ReceivesContext extends true ? [factoryContext: FactoryContext] : [];

type PositionalArguments<
  Dependencies extends readonly DependencyReference[],
  ReceivesContext extends boolean,
> = TokenArguments<Dependencies> extends [...infer Arguments]
  ? [...Arguments, ...FactoryContextArguments<ReceivesContext>]
  : never;

/**
 * A receiver-free callable whose arguments follow the selected dependency tuple.
 * @typeParam Dependencies - The dependency references supplying the positional values.
 * @typeParam Output - The exact callback output.
 * @typeParam ReceivesContext - Whether FactoryContext follows the dependency values.
 */
export type PositionalFactoryFunction<
  Dependencies extends readonly DependencyReference[],
  Output = unknown,
  ReceivesContext extends boolean = false,
> = PositionalArguments<Dependencies, ReceivesContext> extends infer Arguments extends unknown[]
  ? (this: void, ...arguments_: Arguments) => Output
  : never;

type ContextSelection<ReceivesContext extends boolean> = ReceivesContext extends true
  ? { readonly factoryReceivesContext: true }
  : { readonly factoryReceivesContext?: never };

type PositionalReturnKindAdmission<Output, ReturnKind extends FactoryReturnKind> =
  NativeOutput<Output, NoInfer<ReturnKind>>
  & SyncOutput<Output, NoInfer<ReturnKind>>;

type CheckedPositionalReturnKindOptions<Output, ReturnKind extends FactoryReturnKind> =
  'auto-detect' extends ReturnKind
    ? unknown extends PositionalReturnKindAdmission<Output, ReturnKind>
      ? { readonly factoryReturnKind?: ReturnKind & PositionalReturnKindAdmission<Output, ReturnKind> }
      : { readonly factoryReturnKind: ReturnKind & PositionalReturnKindAdmission<Output, ReturnKind> }
    : { readonly factoryReturnKind: ReturnKind & PositionalReturnKindAdmission<Output, ReturnKind> };

/**
 * Create a provider by passing positional dependency values to a receiver-free function.
 * @typeParam Dependencies - The finite tuple of dependency references.
 * @typeParam FactoryFunction - The exact callback signature and output.
 * @typeParam ReturnKind - How the output is acquired.
 * @typeParam ReceivesContext - Whether FactoryContext is appended after dependency values.
 */
export function createProviderFromFunction<
  const Dependencies extends readonly DependencyReference[],
  FactoryFunction extends PositionalFactoryFunction<NoInfer<Dependencies>, any, NoInfer<ReceivesContext>>,
  ReturnKind extends FactoryReturnKind = 'auto-detect',
  ReceivesContext extends boolean = false,
>(options: {
  readonly dependencies: Dependencies & DependencyTupleAdmission<Dependencies>;
  readonly factoryReceivesContext?: ReceivesContext;
  readonly factoryFunction: FactoryFunction
    & PositionalFactoryArguments<PositionalArguments<NoInfer<Dependencies>, NoInfer<ReceivesContext>>, Parameters<NoInfer<FactoryFunction>>>
    & AutoOutput<ReturnType<NoInfer<FactoryFunction>>, NoInfer<ReturnKind>>;
} & ContextSelection<NoInfer<ReceivesContext>>
  & CheckedPositionalReturnKindOptions<ReturnType<NoInfer<FactoryFunction>>, ReturnKind>):
  Provider<OutputFactory<ReturnType<FactoryFunction>>, Readonly<{}>, readonly [], ReferenceGraph<Dependencies>, Acquired<ReturnType<FactoryFunction>, ReturnKind>>;

export function createProviderFromFunction(options: unknown): ProviderBase {
  const bag = snapshotOptionsBag(options, 'createProviderFromFunction', ['dependencies', 'factoryFunction'], ['factoryReturnKind', 'factoryReceivesContext']);
  if (!Array.isArray(bag.dependencies)) throw libraryError(
    'DI_BAG_INVALID_ARGUMENT', 'createProviderFromFunction dependencies must be an array',
    { operation: 'createProviderFromFunction', argument: 'dependencies', expected: 'an array' },
  );
  const references = snapshotReferences(bag.dependencies);
  if (typeof bag.factoryFunction !== 'function') throw libraryError(
    'DI_BAG_INVALID_ARGUMENT', 'createProviderFromFunction requires a factory function',
    { operation: 'createProviderFromFunction', argument: 'factoryFunction', expected: 'a function' },
  );
  if (bag.factoryReceivesContext !== undefined && bag.factoryReceivesContext !== true) throw libraryError(
    'DI_BAG_INVALID_ARGUMENT', 'createProviderFromFunction factoryReceivesContext must be true when present',
    { operation: 'createProviderFromFunction', argument: 'factoryReceivesContext', expected: "one of: 'true'" },
  );
  const returnKind = factoryReturnKind(bag.factoryReturnKind, 'createProviderFromFunction');
  const contextual = bag.factoryReceivesContext === true;
  const factoryFunction = bag.factoryFunction as (...arguments_: readonly unknown[]) => unknown;
  const create = (dependencies: Record<symbol, unknown>, factoryContext?: FactoryContext) => Reflect.apply(
    factoryFunction,
    undefined,
    contextual
      ? [...references.map(reference => Reflect.get(dependencies, reference.slot)), factoryContext!]
      : references.map(reference => Reflect.get(dependencies, reference.slot)),
  );
  const handle = createProvider<OutputFactory<unknown>, Readonly<{}>, readonly [], ReferenceGraph<readonly DependencyReference[]>, unknown>();
  retainDescription(handle, sourceDescription(create, undefined, references.map(reference => reference.key), returnKind, contextual, references));
  return handle;
}

type PositionalClassOptions<
  Dependencies extends readonly DependencyReference[],
  ServiceClass,
  ReturnKind extends FactoryReturnKind,
> = {
  readonly dependencies: Dependencies & DependencyTupleAdmission<Dependencies>;
  readonly serviceClass: ServiceClass;
} & ReturnKindOptions<ReturnKind>;

export function createProviderFromClass<
  const Dependencies extends readonly DependencyReference[],
  ServiceClass extends new (...arguments_: TokenArguments<NoInfer<Dependencies>>) => unknown,
  ReturnKind extends FactoryReturnKind = 'auto-detect',
>(options: PositionalClassOptions<Dependencies, ServiceClass &
  PositionalFactoryArguments<TokenArguments<NoInfer<Dependencies>>, ConstructorParameters<NoInfer<ServiceClass>>> &
  NativeOutput<InstanceType<NoInfer<ServiceClass>>, NoInfer<ReturnKind>> &
  AutoOutput<InstanceType<NoInfer<ServiceClass>>, NoInfer<ReturnKind>> &
  SyncOutput<InstanceType<NoInfer<ServiceClass>>, NoInfer<ReturnKind>>, ReturnKind>):
  Provider<() => InstanceType<ServiceClass>, Readonly<{}>, readonly [], ReferenceGraph<Dependencies>, Acquired<InstanceType<ServiceClass>, ReturnKind>>;

export function createProviderFromClass(options: unknown): ProviderBase {
  const bag = snapshotOptionsBag(options, 'createProviderFromClass', ['dependencies', 'serviceClass'], ['factoryReturnKind']);
  if (!Array.isArray(bag.dependencies)) throw libraryError(
    'DI_BAG_INVALID_ARGUMENT', 'createProviderFromClass dependencies must be an array',
    { operation: 'createProviderFromClass', argument: 'dependencies', expected: 'an array' },
  );
  const references = snapshotReferences(bag.dependencies);
  if (typeof bag.serviceClass !== 'function') throw invalidServiceClass();
  try { Reflect.construct(new Proxy(bag.serviceClass, { construct: () => ({}) }), []); }
  catch { throw invalidServiceClass(); }
  const serviceClass = bag.serviceClass as new (...arguments_: readonly unknown[]) => unknown;
  const returnKind = factoryReturnKind(bag.factoryReturnKind, 'createProviderFromClass');
  const create = (dependencies: Record<symbol, unknown>) => Reflect.construct(
    serviceClass,
    references.map(reference => Reflect.get(dependencies, reference.slot)),
  );
  const handle = createProvider<() => unknown, Readonly<{}>, readonly [], ReferenceGraph<readonly DependencyReference[]>, unknown>();
  retainDescription(handle, sourceDescription(create, undefined, references.map(reference => reference.key), returnKind, false, references));
  return handle;
}

function invalidServiceClass(): Error {
  return libraryError('DI_BAG_INVALID_ARGUMENT', 'createProviderFromClass requires a concrete constructor', {
    operation: 'createProviderFromClass', argument: 'serviceClass', expected: 'a constructor that can be called with new',
  });
}

// Callable assignability allows unused trailing arguments. Composition instead
// checks the supplied tuple against the actual optional/rest parameter tuple.
/**
 * Compile-time admission that checks supplied token values against a callable's parameter tuple.
 * @see https://dany-fedorov.github.io/di-bag/guides/tutorial.html#adapt-classes-and-positional-functions
 */
export type CompositionArguments<A extends readonly unknown[], P extends readonly unknown[]> = [A] extends [P] ? unknown
  : Unsatisfied<'composition arguments must match the declared parameter tuple', { supplied: A; parameters: P }>;

// Materialize the mapped tuple before contextual typing. A still-mapped rest
// gives omitted inline default parameters an erroneous undefined context.
/**
 * A receiver-free positional callback matching the values supplied by a dependency tuple.
 * @see https://dany-fedorov.github.io/di-bag/guides/tutorial.html#adapt-classes-and-positional-functions
 */
export type CompositionFunction<T extends readonly DependencyReference[], O = unknown> = TokenArguments<T> extends [...infer A]
  ? (this: void, ...args: A) => O : never;

/**
 * Adapt a positional function without awaiting its arguments or return value.
 * @param tokens - A finite tuple of typed tokens and dependency references.
 * @param callback - The receiver-free function to call in tuple order.
 * @param modeOptions - Optional acquisition mode for the function result.
 * @returns A lazy provider retaining the dependency graph and exact return type.
 * @typeParam F - The exact positional function signature retained by the provider.
 */
// The first overload contextualizes native callback results (including calling a
// lazy getter); the last preserves the general checked diagnostic/reflected view.
export function fromFunction<const T extends readonly DependencyReference[], F extends CompositionFunction<NoInfer<T>, 'nativePromise' extends M ? Promise<unknown> : unknown>, M extends AcquisitionMode = 'auto'>(
  tokens: T & DependencyTupleAdmission<T>,
  callback: F & CompositionArguments<TokenArguments<NoInfer<T>>, Parameters<NoInfer<F>>> & LegacyNativeOutput<ReturnType<NoInfer<F>>, NoInfer<M>> & LegacyAutoOutput<ReturnType<NoInfer<F>>, NoInfer<M>>,
  ...modeOptions: LegacyStageOptions<M>
): Provider<OutputFactory<ReturnType<F>>, Readonly<{}>, readonly [], ReferenceGraph<T>, LegacyAcquired<ReturnType<F>, M>>;
/**
 * Adapt a positional function whose parameters exactly match the selected dependency values.
 * @param tokens - A finite tuple of typed tokens and dependency references.
 * @param callback - The function invoked once per provider acquisition with no receiver.
 * @param modeOptions - Optional `auto`, `raw`, or `nativePromise` result classification.
 * @returns A reusable provider; no dependency or result is implicitly awaited.
 * @typeParam F - The exact positional function signature retained by the provider.
 */
export function fromFunction<const T extends readonly DependencyReference[], F extends CompositionFunction<NoInfer<T>>, M extends AcquisitionMode = 'auto'>(
  tokens: T & DependencyTupleAdmission<T>,
  callback: F & CompositionArguments<TokenArguments<NoInfer<T>>, Parameters<NoInfer<F>>> & LegacyNativeOutput<ReturnType<NoInfer<F>>, NoInfer<M>> & LegacyAutoOutput<ReturnType<NoInfer<F>>, NoInfer<M>>,
  ...modeOptions: LegacyStageOptions<M>
): Provider<OutputFactory<ReturnType<F>>, Readonly<{}>, readonly [], ReferenceGraph<T>, LegacyAcquired<ReturnType<F>, M>>;
export function fromFunction<const T extends readonly DependencyReference[], F extends CompositionFunction<NoInfer<T>>, M extends AcquisitionMode = 'auto'>(
  tokens: T & DependencyTupleAdmission<T>,
  callback: F & CompositionArguments<TokenArguments<NoInfer<T>>, Parameters<NoInfer<F>>> & LegacyNativeOutput<ReturnType<NoInfer<F>>, NoInfer<M>> & LegacyAutoOutput<ReturnType<NoInfer<F>>, NoInfer<M>>,
  ...modeOptions: LegacyStageOptions<M>
): Provider<OutputFactory<ReturnType<F>>, Readonly<{}>, readonly [], ReferenceGraph<T>, LegacyAcquired<ReturnType<F>, M>> {
  const mode = acquisitionMode(modeOptions[0]);
  const references = snapshotReferences(tokens);
  if (typeof callback !== 'function') throw libraryError('DI_BAG_INVALID_FUNCTION', 'fromFunction callback must be a function', { operation: 'fromFunction' });
  const create = (dependencyProxy: Record<symbol, unknown>) => Reflect.apply(callback, undefined, references.map(reference => Reflect.get(dependencyProxy, reference.slot)));
  const handle = createProvider<OutputFactory<ReturnType<F>>, Readonly<{}>, readonly [], ReferenceGraph<T>, LegacyAcquired<ReturnType<F>, M>>();
  retainDescription(handle, sourceDescription(create, undefined, references.map(reference => reference.key), normalizeLegacyMode(mode), false, references));
  return handle;
}

/**
 * Adapt a concrete constructor while preserving its prototype, private fields, and `new.target`.
 * @param tokens - A finite tuple whose dependency values match the constructor parameters.
 * @param constructor - The concrete class or constructable function to instantiate.
 * @param modeOptions - Optional acquisition mode for the constructed result.
 * @returns A lazy provider that constructs one instance per acquisition attempt.
 * @throws When the supplied runtime value is not constructable.
 */
export function fromClass<const T extends readonly DependencyReference[], C extends new (...args: TokenArguments<NoInfer<T>>) => unknown, M extends AcquisitionMode = 'auto'>(
  tokens: T & DependencyTupleAdmission<T>,
  constructor: C & CompositionArguments<TokenArguments<NoInfer<T>>, ConstructorParameters<NoInfer<C>>> & LegacyNativeOutput<InstanceType<NoInfer<C>>, NoInfer<M>> & LegacyAutoOutput<InstanceType<NoInfer<C>>, NoInfer<M>>,
  ...modeOptions: LegacyStageOptions<M>
): Provider<() => InstanceType<C>, Readonly<{}>, readonly [], ReferenceGraph<T>, LegacyAcquired<InstanceType<C>, M>> {
  const mode = acquisitionMode(modeOptions[0]);
  const references = snapshotReferences(tokens);
  // A Proxy is constructable exactly when its target is. Its inert trap avoids
  // running the target or reading its prototype, even when the target is a Proxy.
  if (typeof constructor !== 'function') throw libraryError('DI_BAG_INVALID_CONSTRUCTOR', 'fromClass requires a concrete constructor', { operation: 'fromClass' });
  try { Reflect.construct(new Proxy(constructor, { construct: () => ({}) }), []); }
  catch { throw libraryError('DI_BAG_INVALID_CONSTRUCTOR', 'fromClass requires a concrete constructor', { operation: 'fromClass' }); }
  const create = (dependencyProxy: Record<symbol, unknown>) => Reflect.construct(constructor, references.map(reference => Reflect.get(dependencyProxy, reference.slot)));
  const handle = createProvider<() => InstanceType<C>, Readonly<{}>, readonly [], ReferenceGraph<T>, LegacyAcquired<InstanceType<C>, M>>();
  retainDescription(handle, sourceDescription(create, undefined, references.map(reference => reference.key), normalizeLegacyMode(mode), false, references));
  return handle;
}
