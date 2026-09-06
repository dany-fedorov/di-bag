import type { ProviderBase } from './provider';
import { normalize, retainDescription, sourceDescription } from './provider-operations';
export { normalize } from './provider-operations';

// Contravariant bottom accepts each factory's actual parameter type without any.
export type Factory = (this: void, deps: never) => unknown;

// A private member is lost on spread; structural copies cannot be registrations.
class Owned<F extends Factory> {
  declare private readonly nominal: void;
  constructor(readonly create: F) {}
}

export type DisposableFactory<F extends Factory> = Owned<F>;

export type Registration = Factory | Owned<Factory> | ProviderBase;

export type Registrations = Record<string, Registration>;

/** Declare that each bag owns, and must dispose, this factory's fulfilled value. */
export function withDisposal<F extends Factory>(
  create: F,
  dispose: (value: Awaited<ReturnType<NoInfer<F>>>) => void | Promise<void>,
): DisposableFactory<F> {
  const handle = new Owned(create);
  retainDescription(handle, sourceDescription(create, dispose));
  return handle;
}

/** Preflight every own key before reading getters; retain hidden own entries. */
export function snapshotAdd(more: unknown, hasKey: (key: string) => boolean): Registrations {
  if (typeof more !== 'object' || more === null || Array.isArray(more)) {
    throw new Error('registrations must be a string-keyed object');
  }
  const keys = Reflect.ownKeys(more);
  for (const key of keys) {
    if (typeof key !== 'string') throw new Error('registration keys must be strings');
    if (hasKey(key)) throw new Error(`duplicate registration: ${key}`);
  }
  const snapshot: Registrations = Object.create(null);
  for (const key of keys as string[]) {
    const registration: unknown = Reflect.get(more, key);
    normalize(registration);
    snapshot[key] = registration as Registration;
  }
  return snapshot;
}
