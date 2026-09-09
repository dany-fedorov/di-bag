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
export type CompositionArguments<A extends readonly unknown[], P extends readonly unknown[]> = [A] extends [P] ? unknown
  : Unsatisfied<'composition arguments must match the declared parameter tuple', { supplied: A; parameters: P }>;

// Materialize the mapped tuple before contextual typing. A still-mapped rest
// gives omitted inline default parameters an erroneous undefined context.
export type CompositionFunction<T extends readonly Dependency[], O = unknown> = TokenArguments<T> extends [...infer A]
  ? (this: void, ...args: A) => O : never;

/** Adapt a positional function without awaiting its arguments or return value. */
// The first overload contextualizes native callback results (including calling a
// lazy getter); the last preserves the general checked diagnostic/reflected view.
export function fromFunction<const T extends readonly Dependency[], F extends CompositionFunction<NoInfer<T>, 'native' extends M ? Promise<unknown> : unknown>, M extends AcquisitionMode = 'auto'>(
  tokens: T & DependencyTupleAdmission<T>,
  callback: F & CompositionArguments<TokenArguments<NoInfer<T>>, Parameters<NoInfer<F>>> & NativeOutput<ReturnType<NoInfer<F>>, NoInfer<M>>,
  ...modeOptions: StageOptions<M>
): Provider<() => ReturnType<F>, Readonly<{}>, readonly [], ReferenceGraph<T>, Acquired<ReturnType<F>, M>>;
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

/** Adapt a concrete constructor while preserving prototypes and new.target. */
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
