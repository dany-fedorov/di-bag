import type { ProviderBase, Provider, ProviderFactory, ProviderAcquired, RetainedMetadata, ProviderAcquisitionMetadata, ProviderGraph } from './provider';
export { normalize } from './provider-operations';
export type Factory = (this: void, deps: never) => unknown;
declare class Owned<F extends Factory> {
    readonly create: F;
    private readonly nominal;
    constructor(create: F);
}
/** A nominal registration pairing a factory with fulfilled-value cleanup. */
export type DisposableFactory<F extends Factory> = Owned<F>;
/** A factory, disposable factory, or immutable provider accepted by builders and decorators. */
export type Registration = Factory | Owned<Factory> | ProviderBase;
export type Registrations = Record<string, Registration>;
/**
 * Declare that each acquiring bag owns a factory's fulfilled value.
 * Neither callback runs until acquisition; cleanup runs once after dependent resources.
 * @param create - The receiver-free service factory.
 * @param dispose - Cleanup for its fulfilled value; it may complete synchronously or asynchronously.
 * @returns A nominal disposable registration preserving the factory's exact output.
 */
export declare function withDisposal<F extends Factory>(create: F, dispose: (this: void, value: Awaited<ReturnType<NoInfer<F>>>) => void | Promise<void>): DisposableFactory<F>;
/**
 * Add an ownership stage to an existing registration.
 * Earlier disposal stages remain attached and run after this stage in reverse order.
 * @param provider - The registration whose acquired value becomes owned at this stage.
 * @param dispose - Cleanup for the registration's acquired value.
 * @returns A provider retaining output, dependencies, metadata, frames, and earlier ownership.
 */
export declare function withDisposal<R extends Registration>(provider: R & Registration, dispose: (this: void, value: ProviderAcquired<NoInfer<R>>) => void | Promise<void>): Provider<ProviderFactory<R>, RetainedMetadata<R>, ProviderAcquisitionMetadata<R>, ProviderGraph<R>, ProviderAcquired<R>>;
/** Preflight every own key before reading getters; retain hidden own entries. */
export declare function snapshotAdd(more: unknown, hasKey: (key: string) => boolean): Registrations;
