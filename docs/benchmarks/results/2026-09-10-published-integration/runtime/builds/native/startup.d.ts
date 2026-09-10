import { Runtime } from './runtime';
import type { BindingGraph } from './runtime';
import type { RuntimeContext } from './acquisition-mode';
/** Controls eager acquisition performed by {@link Builder.start}. */
export interface StartupOptions {
    /** An external signal that promptly cancels the startup wait and begins cleanup. */
    readonly signal?: AbortSignal;
    /** A finite positive deadline in milliseconds. */
    readonly timeoutMs?: number;
    /** Start together (`parallel`, default), in tuple order (`sequential`), or with a positive safe integer bound on selected readiness waits. Dependency fanout is not bounded. */
    readonly concurrency?: 'parallel' | 'sequential' | number;
}
/** One startup transaction; never assimilate an exposed service to establish readiness. */
export declare function startRuntime(graph: BindingGraph, context: RuntimeContext, keys: readonly unknown[], options?: StartupOptions): Promise<Runtime>;
