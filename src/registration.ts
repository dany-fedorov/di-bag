import { libraryError } from './errors';
import type { ProviderBase } from './provider';
import { normalize } from './provider-operations';
export { normalize } from './provider-operations';

// Contravariant bottom accepts each factory's actual parameter type without any.
export type Factory = (this: void, dependencies: never) => unknown;

/** A plain factory or immutable provider accepted by provider composition facades. */
export type ProviderOrFactory = Factory | ProviderBase;

export type Registrations = Record<string, ProviderOrFactory>;

/** Preflight every own key before reading getters; retain hidden own entries. */
export function snapshotAdd(providersByName: unknown, hasKey: (key: string) => boolean): Registrations {
  const operation = 'withServices';
  if (typeof providersByName !== 'object' || providersByName === null || Array.isArray(providersByName)) {
    throw libraryError('DI_BAG_INVALID_REGISTRATION', 'registrations must be a string-keyed object', { operation });
  }
  const keys = Reflect.ownKeys(providersByName);
  for (const key of keys) {
    if (typeof key !== 'string') throw libraryError('DI_BAG_INVALID_REGISTRATION', 'registration keys must be strings', { operation });
    if (hasKey(key)) throw libraryError('DI_BAG_DUPLICATE_REGISTRATION', `duplicate registration: ${key}`, { operation, key });
  }
  const snapshot: Registrations = Object.create(null);
  for (const key of keys as string[]) {
    const registration: unknown = Reflect.get(providersByName, key);
    normalize(registration, operation);
    snapshot[key] = registration as ProviderOrFactory;
  }
  return snapshot;
}
