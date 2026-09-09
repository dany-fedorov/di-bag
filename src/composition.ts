import { acquisitionMode } from './acquisition-mode';
import type { Acquired, AcquisitionMode, NativeOutput, StageOptions } from './acquisition-mode';
import { createProvider } from './provider';
import type { Provider } from './provider';
import { retainDescription, sourceDescription } from './provider-operations';
import { snapshotReferences } from './dependency-references';
import type { Dependency } from './dependency-references';
import type { TokenArguments, ReferenceGraph, DependencyTupleAdmission } from './token-types';
import type { Unsatisfied } from './types';

// Callable assignability allows unused trailing arguments. Composition instead
// checks the supplied tuple against the actual optional/rest parameter tuple.
/** Compile-time admission that checks supplied token values against a callable's parameter tuple. */
export type CompositionArguments<A extends readonly unknown[], P extends readonly unknown[]> = [A] extends [P] ? unknown
  : Unsatisfied<'composition arguments must match the declared parameter tuple', { supplied: A; parameters: P }>;

// Materialize the mapped tuple before contextual typing. A still-mapped rest
// gives omitted inline default parameters an erroneous undefined context.
/** A receiver-free positional callback matching the values supplied by a dependency tuple. */
export type CompositionFunction<T extends readonly Dependency[], O = unknown> = TokenArguments<T> extends [...infer A]
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
export function fromFunction<const T extends readonly Dependency[], F extends CompositionFunction<NoInfer<T>, 'native' extends M ? Promise<unknown> : unknown>, M extends AcquisitionMode = 'auto'>(
  tokens: T & DependencyTupleAdmission<T>,
  callback: F & CompositionArguments<TokenArguments<NoInfer<T>>, Parameters<NoInfer<F>>> & NativeOutput<ReturnType<NoInfer<F>>, NoInfer<M>>,
  ...modeOptions: StageOptions<M>
): Provider<() => ReturnType<F>, Readonly<{}>, readonly [], ReferenceGraph<T>, Acquired<ReturnType<F>, M>>;
/**
 * Adapt a positional function whose parameters exactly match the selected dependency values.
 * @param tokens - A finite tuple of typed tokens and dependency references.
 * @param callback - The function invoked once per provider acquisition with no receiver.
 * @param modeOptions - Optional `auto`, `raw`, or `native` result classification.
 * @returns A reusable provider; no dependency or result is implicitly awaited.
 * @typeParam F - The exact positional function signature retained by the provider.
 */
export function fromFunction<const T extends readonly Dependency[], F extends CompositionFunction<NoInfer<T>>, M extends AcquisitionMode = 'auto'>(
  tokens: T & DependencyTupleAdmission<T>,
  callback: F & CompositionArguments<TokenArguments<NoInfer<T>>, Parameters<NoInfer<F>>> & NativeOutput<ReturnType<NoInfer<F>>, NoInfer<M>>,
  ...modeOptions: StageOptions<M>
): Provider<() => ReturnType<F>, Readonly<{}>, readonly [], ReferenceGraph<T>, Acquired<ReturnType<F>, M>>;
export function fromFunction<const T extends readonly Dependency[], F extends CompositionFunction<NoInfer<T>>, M extends AcquisitionMode = 'auto'>(
  tokens: T & DependencyTupleAdmission<T>,
  callback: F & CompositionArguments<TokenArguments<NoInfer<T>>, Parameters<NoInfer<F>>> & NativeOutput<ReturnType<NoInfer<F>>, NoInfer<M>>,
  ...modeOptions: StageOptions<M>
): Provider<() => ReturnType<F>, Readonly<{}>, readonly [], ReferenceGraph<T>, Acquired<ReturnType<F>, M>> {
  const acquisition = acquisitionMode(modeOptions[0]);
  const references = snapshotReferences(tokens);
  if (typeof callback !== 'function') throw new Error('composition callback must be a function');
  const create = (deps: Record<symbol, unknown>) => Reflect.apply(callback, undefined, references.map(reference => Reflect.get(deps, reference.slot)));
  const handle = createProvider<() => ReturnType<F>, Readonly<{}>, readonly [], ReferenceGraph<T>, Acquired<ReturnType<F>, M>>();
  retainDescription(handle, sourceDescription(create, undefined, references.map(reference => reference.key), acquisition, false, references));
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
export function fromClass<const T extends readonly Dependency[], C extends new (...args: TokenArguments<NoInfer<T>>) => unknown, M extends AcquisitionMode = 'auto'>(
  tokens: T & DependencyTupleAdmission<T>,
  constructor: C & CompositionArguments<TokenArguments<NoInfer<T>>, ConstructorParameters<NoInfer<C>>> & NativeOutput<InstanceType<NoInfer<C>>, NoInfer<M>>,
  ...modeOptions: StageOptions<M>
): Provider<() => InstanceType<C>, Readonly<{}>, readonly [], ReferenceGraph<T>, Acquired<InstanceType<C>, M>> {
  const acquisition = acquisitionMode(modeOptions[0]);
  const references = snapshotReferences(tokens);
  // A Proxy is constructable exactly when its target is. Its inert trap avoids
  // running the target or reading its prototype, even when the target is a Proxy.
  if (typeof constructor !== 'function') throw new Error('composition requires a concrete constructor');
  try { Reflect.construct(new Proxy(constructor, { construct: () => ({}) }), []); }
  catch { throw new Error('composition requires a concrete constructor'); }
  const create = (deps: Record<symbol, unknown>) => Reflect.construct(constructor, references.map(reference => Reflect.get(deps, reference.slot)));
  const handle = createProvider<() => InstanceType<C>, Readonly<{}>, readonly [], ReferenceGraph<T>, Acquired<InstanceType<C>, M>>();
  retainDescription(handle, sourceDescription(create, undefined, references.map(reference => reference.key), acquisition, false, references));
  return handle;
}
