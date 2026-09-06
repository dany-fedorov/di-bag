// Contravariant bottom accepts each factory's actual parameter type without any.
export type Factory = (deps: never) => unknown;

const disposalBrand: unique symbol = Symbol('di-bag.disposal');

export interface DisposableFactory<F extends Factory> {
  readonly [disposalBrand]: true;
  readonly create: F;
  readonly dispose: (value: Awaited<ReturnType<F>>) => void | Promise<void>;
}

export type Registration =
  | Factory
  | {
      readonly [disposalBrand]: true;
      readonly create: Factory;
      readonly dispose: (value: never) => void | Promise<void>;
    };

export type Registrations = Record<string, Registration>;

/** Declare that each bag owns, and must dispose, this factory's fulfilled value. */
export function withDisposal<F extends Factory>(
  create: F,
  dispose: (value: Awaited<ReturnType<NoInfer<F>>>) => void | Promise<void>,
): DisposableFactory<F> {
  return Object.freeze({ [disposalBrand]: true as const, create, dispose });
}

export function normalize(registration: Registration): {
  create: Factory;
  dispose?: (value: never) => void | Promise<void>;
} {
  if (typeof registration === 'function') return { create: registration };
  if (registration?.[disposalBrand] === true) return registration;
  throw new Error('invalid factory registration');
}
