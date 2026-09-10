import { libraryError } from './errors';
import { transform } from './provider';
import type { ProviderBase, Provider, ProviderFactory, ProviderAcquiredValue, RetainedMetadata, ProviderAcquisitionMetadata, ProviderGraphContract } from './provider';
import { normalize, retainDescription, sourceDescription } from './provider-operations';
export { normalize } from './provider-operations';

// Contravariant bottom accepts each factory's actual parameter type without any.
export type Factory = (this: void, deps: never) => unknown;

// A private member is lost on spread; structural copies cannot be registrations.
/** A nominal registration pairing a factory with fulfilled-value cleanup. */
class FactoryWithDisposal<F extends Factory> {
  declare private readonly nominal: void;
  constructor(readonly create: F) {}
}

/** A nominal registration pairing a factory with fulfilled-value cleanup. */
export type { FactoryWithDisposal };

/** A factory, disposable factory, or immutable provider accepted by builders and decorators. */
export type Registration = Factory | FactoryWithDisposal<Factory> | ProviderBase;

export type Registrations = Record<string, Registration>;

/**
 * Declare that each acquiring bag owns a factory's fulfilled value.
 * Neither callback runs until acquisition; cleanup runs once after dependent resources.
 * @param create - The receiver-free service factory.
 * @param dispose - Cleanup for its fulfilled value; it may complete synchronously or asynchronously.
 * @returns A nominal disposable registration preserving the factory's exact output.
 */
export function withDisposal<F extends Factory>(
  create: F,
  dispose: (this: void, value: Awaited<ReturnType<NoInfer<F>>>) => void | Promise<void>,
): FactoryWithDisposal<F>;
/**
 * Add an ownership stage to an existing registration.
 * Earlier disposal stages remain attached and run after this stage in reverse order.
 * @param provider - The registration whose acquired value becomes owned at this stage.
 * @param dispose - Cleanup for the registration's acquired value.
 * @returns A provider retaining output, dependencies, metadata, frames, and earlier ownership.
 */
export function withDisposal<R extends Registration>(
  provider: R & Registration,
  dispose: (this: void, value: ProviderAcquiredValue<NoInfer<R>>) => void | Promise<void>,
): Provider<ProviderFactory<R>, RetainedMetadata<R>, ProviderAcquisitionMetadata<R>, ProviderGraphContract<R>, ProviderAcquiredValue<R>>;
export function withDisposal(
  registration: Registration,
  dispose: (value: never) => void | Promise<void>,
): FactoryWithDisposal<Factory> | ProviderBase {
  if (typeof registration !== 'function') return transform(registration, { kind: 'owned', dispose });
  const handle = new FactoryWithDisposal(registration);
  retainDescription(handle, sourceDescription(registration, dispose));
  return handle;
}

/** Preflight every own key before reading getters; retain hidden own entries. */
export function snapshotAdd(more: unknown, hasKey: (key: string) => boolean): Registrations {
  if (typeof more !== 'object' || more === null || Array.isArray(more)) {
    throw libraryError('DI_BAG_INVALID_REGISTRATION', 'registrations must be a string-keyed object', { operation: 'register' });
  }
  const keys = Reflect.ownKeys(more);
  for (const key of keys) {
    if (typeof key !== 'string') throw libraryError('DI_BAG_INVALID_REGISTRATION', 'registration keys must be strings', { operation: 'register' });
    if (hasKey(key)) throw libraryError('DI_BAG_DUPLICATE_REGISTRATION', `duplicate registration: ${key}`, { operation: 'register', key });
  }
  const snapshot: Registrations = Object.create(null);
  for (const key of keys as string[]) {
    const registration: unknown = Reflect.get(more, key);
    normalize(registration);
    snapshot[key] = registration as Registration;
  }
  return snapshot;
}
