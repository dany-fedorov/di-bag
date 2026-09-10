import type { Observers } from './observers';
import type { Unsatisfied } from './types';
/**
 * How an acquisition stage treats its returned value: configured classification,
 * the exact raw value, or an observed native Promise fulfillment.
 */
export type AcquisitionMode = 'auto' | 'raw' | 'native';
/** Portable facade configuration for `auto` acquisition stages. */
export interface RuntimeOptions {
    /** Return true only for native Promises the host can observe without thenable assimilation. */
    readonly isNativePromise: (this: void, value: unknown) => boolean;
}
export interface RuntimeContext {
    readonly isNativePromise?: RuntimeOptions['isNativePromise'];
    readonly observers?: Observers;
}
export declare const unconfigured: RuntimeContext;
export declare function runtimeContext(options: RuntimeOptions, previous?: RuntimeContext): RuntimeContext;
export type Acquired<O, M extends AcquisitionMode> = M extends 'raw' ? O : Awaited<O>;
export type ModeOptions<M extends AcquisitionMode, Default extends AcquisitionMode = 'auto'> = Default extends M ? {
    readonly acquisition?: M;
} : {
    readonly acquisition: M;
};
export type StageOptions<M extends AcquisitionMode> = 'auto' extends M ? [options?: {
    readonly acquisition: M;
}] : [options: {
    readonly acquisition: M;
}];
export type NativeOutput<O, M extends AcquisitionMode> = 'native' extends M ? [O] extends [Promise<unknown>] ? unknown : Unsatisfied<'native acquisition requires a Promise output', {}> : unknown;
export declare function acquisitionMode(options: {
    readonly acquisition?: AcquisitionMode;
} | undefined, fallback?: AcquisitionMode): AcquisitionMode;
export declare function requireClassificationCapability(modes: Iterable<AcquisitionMode>, context: RuntimeContext): void;
