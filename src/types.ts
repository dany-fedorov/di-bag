import type { Factory, Registration, Registrations } from './registration';

type FactoryOf<R extends Registration> = R extends Factory
  ? R
  : R extends { create: infer F extends Factory }
    ? F
    : never;

type Needs<R extends Registration> =
  Parameters<FactoryOf<R>> extends []
    ? Record<never, never>
    : Exclude<Parameters<FactoryOf<R>>[0], undefined>;

export type Provided<R extends Registrations> = {
  [K in keyof R]: ReturnType<FactoryOf<R[K]>>;
};

export type Merge<F extends Registrations, N extends Registrations> = Omit<
  F,
  keyof N
> &
  N;

declare const errorBrand: unique symbol;
type Unsatisfied<Message extends string, Details> = {
  readonly [errorBrand]: Message;
} & Details;

type IsUnion<T, Whole = T> = T extends Whole
  ? [Whole] extends [T]
    ? false
    : true
  : never;

// An empty object satisfies an index signature, but cannot supply a required
// literal property. This also catches template indices such as `db:${string}`.
type NonFiniteKeys<T> = {
  [K in keyof T]-?: Record<never, never> extends Record<K, never> ? K : never;
}[keyof T];

type InvalidNeeds<R extends Registrations> = {
  [K in keyof R]: true extends IsUnion<Needs<R[K]>>
    ? K
    : Needs<R[K]> extends (...args: never[]) => unknown
      ? K
      : Needs<R[K]> extends abstract new (...args: never[]) => unknown
        ? K
        : [Needs<R[K]>] extends [object]
          ? [NonFiniteKeys<Needs<R[K]>>] extends [never]
            ? [Exclude<keyof Needs<R[K]>, string>] extends [never]
              ? never
              : K
            : K
          : K;
}[keyof R];

type WrongShapes<R extends Registrations> = {
  [K in keyof R]: Pick<Provided<R>, keyof Needs<R[K]> & keyof R> extends Pick<
    Needs<R[K]>,
    keyof Needs<R[K]> & keyof R
  >
    ? never
    : K;
}[keyof R];

export type Checked<R extends Registrations> = [
  InvalidNeeds<R> | NonFiniteKeys<R> | Exclude<keyof R, string>,
] extends [never]
  ? [WrongShapes<R>] extends [never]
    ? unknown
    : Unsatisfied<
        'a dependency has the wrong shape',
        { tokens: WrongShapes<R> }
      >
  : Unsatisfied<
      'factory dependencies must be finite string-keyed objects',
      {
        tokens: InvalidNeeds<R> | NonFiniteKeys<R> | Exclude<keyof R, string>;
      }
    >;

type RequiredOf<R extends Registrations> = {
  [K in keyof R]: keyof Needs<R[K]>;
}[keyof R];

export type Complete<R extends Registrations> = [
  Exclude<RequiredOf<R>, keyof R>,
] extends [never]
  ? unknown
  : Unsatisfied<
      'missing factories',
      { missing: Exclude<RequiredOf<R>, keyof R> }
    >;

type BadOverrides<F extends Registrations, O extends Registrations> = {
  [K in keyof O & keyof F]: Provided<O>[K] extends Provided<F>[K] ? never : K;
}[keyof O & keyof F];

export type Overrides<F extends Registrations, O extends Registrations> = [
  Exclude<keyof O, keyof F>,
] extends [never]
  ? [BadOverrides<F, O>] extends [never]
    ? unknown
    : Unsatisfied<
        'override value is not assignable to the original token',
        { tokens: BadOverrides<F, O> }
      >
  : Unsatisfied<
      'fork accepts existing tokens only',
      { extra: Exclude<keyof O, keyof F> }
    >;
