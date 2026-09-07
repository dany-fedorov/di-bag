import { acquisitionMode } from './acquisition-mode';
import type { Acquired, AcquisitionMode, NativeOutput, StageOptions } from './acquisition-mode';
import { createProvider } from './provider';
import type { Provider } from './provider';
import { retainDescription, sourceDescription } from './provider-operations';
import { readTokenKey, snapshotTokens } from './tokens';
import type { TokenBase } from './tokens';
import type { TokenArguments, TokenGraph, TokenTupleAdmission } from './token-types';
import type { Unsatisfied } from './types';

// Callable assignability allows unused trailing arguments. Composition instead
// checks the supplied tuple against the actual optional/rest parameter tuple.
export type CompositionArguments<A extends readonly unknown[], P extends readonly unknown[]> = [A] extends [P] ? unknown
  : Unsatisfied<'composition arguments must match the declared parameter tuple', { supplied: A; parameters: P }>;

// Materialize the mapped tuple before contextual typing. A still-mapped rest
// gives omitted inline default parameters an erroneous undefined context.
export type CompositionFunction<T extends readonly TokenBase[]> = TokenArguments<T> extends [...infer A]
  ? (this: void, ...args: A) => unknown : never;

/** Adapt a positional function without awaiting its arguments or return value. */
export function fromFunction<const T extends readonly TokenBase[], F extends CompositionFunction<NoInfer<T>>, M extends AcquisitionMode = 'auto'>(
  tokens: T & TokenTupleAdmission<T>,
  callback: F & CompositionArguments<TokenArguments<NoInfer<T>>, Parameters<NoInfer<F>>> & NativeOutput<ReturnType<NoInfer<F>>, NoInfer<M>>,
  ...modeOptions: StageOptions<M>
): Provider<() => ReturnType<F>, Readonly<{}>, readonly [], TokenGraph<T>, Acquired<ReturnType<F>, M>> {
  const acquisition = acquisitionMode(modeOptions[0]);
  const tokenKeys = Object.freeze(snapshotTokens(tokens).map(readTokenKey));
  if (typeof callback !== 'function') throw new Error('composition callback must be a function');
  const create = (deps: Record<symbol, unknown>) => Reflect.apply(callback, undefined, tokenKeys.map(key => Reflect.get(deps, key)));
  const handle = createProvider<() => ReturnType<F>, Readonly<{}>, readonly [], TokenGraph<T>, Acquired<ReturnType<F>, M>>();
  retainDescription(handle, sourceDescription(create, undefined, tokenKeys, acquisition));
  return handle;
}

/** Adapt a concrete constructor while preserving prototypes and new.target. */
export function fromClass<const T extends readonly TokenBase[], C extends new (...args: TokenArguments<NoInfer<T>>) => unknown, M extends AcquisitionMode = 'auto'>(
  tokens: T & TokenTupleAdmission<T>,
  constructor: C & CompositionArguments<TokenArguments<NoInfer<T>>, ConstructorParameters<NoInfer<C>>> & NativeOutput<InstanceType<NoInfer<C>>, NoInfer<M>>,
  ...modeOptions: StageOptions<M>
): Provider<() => InstanceType<C>, Readonly<{}>, readonly [], TokenGraph<T>, Acquired<InstanceType<C>, M>> {
  const acquisition = acquisitionMode(modeOptions[0]);
  const tokenKeys = Object.freeze(snapshotTokens(tokens).map(readTokenKey));
  // A Proxy is constructable exactly when its target is. Its inert trap avoids
  // running the target or reading its prototype, even when the target is a Proxy.
  if (typeof constructor !== 'function') throw new Error('composition requires a concrete constructor');
  try { Reflect.construct(new Proxy(constructor, { construct: () => ({}) }), []); }
  catch { throw new Error('composition requires a concrete constructor'); }
  const create = (deps: Record<symbol, unknown>) => Reflect.construct(constructor, tokenKeys.map(key => Reflect.get(deps, key)));
  const handle = createProvider<() => InstanceType<C>, Readonly<{}>, readonly [], TokenGraph<T>, Acquired<InstanceType<C>, M>>();
  retainDescription(handle, sourceDescription(create, undefined, tokenKeys, acquisition));
  return handle;
}
