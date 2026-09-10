import type { BindingGraph, BindingKey, BindingId } from './runtime';
/** Validate both selections before reading any override value or building a graph. */
export declare function selectScope(graph: BindingGraph, args: readonly unknown[], isTransient: (key: BindingKey) => boolean): {
    readonly graph: BindingGraph;
    readonly shared: readonly BindingId[];
};
