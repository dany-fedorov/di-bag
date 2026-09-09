import { createProvider } from './provider';
import type { Provider } from './provider';
import { retainDescription, sourceDescription } from './provider-operations';
import { acquisitionMode } from './acquisition-mode';
import type { Acquired, AcquisitionMode, StageOptions } from './acquisition-mode';
import type { TokenGraph } from './token-types';

export interface AcquisitionContext {
  readonly signal: AbortSignal;
}

type ContextFactory = (this: void, deps: never, context: AcquisitionContext) => unknown;
export type ContextualFactory<F extends ContextFactory> = (this: void,
  deps: Parameters<F> extends [] ? {} : Parameters<F>[0],
) => ReturnType<F>;

/** Supply the acquisition owner's signal without reserving a dependency name. */
export function withContext<
  F extends (this: void, deps: never, context: AcquisitionContext) => ('native' extends M ? Promise<unknown> : unknown),
  M extends AcquisitionMode = 'auto',
>(callback: F, ...modeOptions: StageOptions<M>): Provider<ContextualFactory<F>, Readonly<{}>, readonly [], TokenGraph, Acquired<ReturnType<F>, M>> {
  if (typeof callback !== 'function') throw new Error('context callback must be a function');
  const mode = acquisitionMode(modeOptions[0]);
  const create = (deps: never, context?: AcquisitionContext) => callback(deps, context!);
  const handle = createProvider<ContextualFactory<F>, Readonly<{}>, readonly [], TokenGraph, Acquired<ReturnType<F>, M>>();
  retainDescription(handle, sourceDescription(create, undefined, [], mode, true));
  return handle;
}
