// Contravariant bottom accepts each factory's actual parameter type without any.
export type Factory = (this: void, deps: never) => unknown;

// A private member is lost on spread; structural copies cannot be registrations.
class Owned<F extends Factory> {
  declare private readonly nominal: void;
  constructor(readonly create: F) {}
}

export type DisposableFactory<F extends Factory> = Owned<F>;

export type Registration = Factory | Owned<Factory>;

type Normalized = {
  create: Factory;
  dispose?: (value: never) => void | Promise<void>;
};

const ownedRegistrations = new WeakMap<object, Normalized>();

export type Registrations = Record<string, Registration>;

/** Declare that each bag owns, and must dispose, this factory's fulfilled value. */
export function withDisposal<F extends Factory>(
  create: F,
  dispose: (value: Awaited<ReturnType<NoInfer<F>>>) => void | Promise<void>,
): DisposableFactory<F> {
  const handle = new Owned(create);
  ownedRegistrations.set(handle, { create, dispose });
  Object.freeze(handle);
  return handle;
}

export function normalize(registration: unknown): Normalized {
  if (typeof registration === 'function') {
    return { create: registration as Factory };
  }
  if (typeof registration === 'object' && registration !== null) {
    const owned = ownedRegistrations.get(registration);
    // Never leak the registry's mutable record through internal normalization.
    if (owned) return { ...owned };
  }
  throw new Error('invalid factory registration');
}
