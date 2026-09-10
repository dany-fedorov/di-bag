import type { Dependency } from './dependency-references';
import type { Provider } from './provider';
import type { DependencyTupleAdmission, ReferenceGraph } from './token-types';
/** The explicit output boundary used for an application-selected plugin. */
export type PluginAcquisition = 'raw' | 'native';
/** A synchronous predicate that admits an unknown plugin output as a service type. */
export type PluginPredicate<V> = (this: void, value: unknown) => value is V;
/** Validation and acquisition choices for {@link fromPlugin}. */
export interface PluginOptions<M extends PluginAcquisition, V> {
    /** Preserve the exact result with `raw`, or await a genuine native Promise with `native`. */
    readonly acquisition: M;
    /** Must synchronously return exactly `true` for acceptable output values. */
    readonly validate: PluginPredicate<V>;
}
/** The provider contract produced by {@link fromPlugin}. */
export type PluginResult<T extends readonly Dependency[], V, M extends PluginAcquisition> = Provider<() => M extends 'raw' ? V : Promise<Awaited<V>>, Readonly<{}>, readonly [], ReferenceGraph<T>, M extends 'raw' ? V : Awaited<V>>;
/**
 * Validate an unknown plugin descriptor and its output at a declared dependency boundary.
 * The descriptor must have own `apiVersion: 1` and callable `create`, with an optional
 * callable `dispose`. A disposer owns the original acquired value before validation.
 * @param dependencies - Host values supplied to the plugin in positional order.
 * @param plugin - The application-selected unknown descriptor.
 * @param options - Required raw/native acquisition and a synchronous output predicate.
 * @returns A lazy provider that validates its output when acquired.
 * @throws {@link DiBagPluginError} for an invalid descriptor or rejected output.
 */
export declare function fromPlugin<const T extends readonly Dependency[], V, M extends PluginAcquisition>(dependencies: T & DependencyTupleAdmission<T>, plugin: unknown, options: PluginOptions<M, V>): PluginResult<T, V, M>;
