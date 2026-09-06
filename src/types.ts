import type {
  DisposableFactory,
  Registration,
  Registrations,
} from './registration';
import type { ProviderContext, ProviderNeeds, ProviderOutput, ProviderGraph } from './provider';
import type { InvalidGraphs, MissingTokens, SelectionKey, TokenMember, ValidToken, TokenGraph } from './token-types';

export type Needs<R extends Registration> = ProviderNeeds<R>;

export type Provided<R extends Registrations> = {
  [K in keyof R]: ProviderOutput<R[K]>;
};

// Keep builder history flat; reconstruct a map only at graph-check boundaries.
export type Entry = { key: string | symbol; registration: Registration };

export type Entries<R extends Registrations> = {
  [K in keyof R & (string | symbol)]: { key: K; registration: R[K] };
}[keyof R & (string | symbol)];

export type From<E extends Entry> = {
  [P in E as P['key']]: P['registration'];
};

export type Merge<F extends Registrations, N extends Registrations> = Omit<
  F,
  keyof N
> &
  N;

declare const errorBrand: unique symbol;
export type Unsatisfied<Message extends string, Details> = {
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
  InvalidNeeds<R> | NonFiniteKeys<R> | Extract<keyof R, number>,
] extends [never]
  ? [InvalidGraphs<R>] extends [never] ? [WrongShapes<R>] extends [never]
    ? unknown
    : Unsatisfied<
        'a dependency has the wrong shape',
        { tokens: WrongShapes<R> }
      >
    : Unsatisfied<'token dependency has an incompatible or opaque contract', { tokens: InvalidGraphs<R> }>
  : Unsatisfied<
      'factory dependencies must be finite string-keyed objects',
      {
        tokens: InvalidNeeds<R> | NonFiniteKeys<R> | Exclude<keyof R, string>;
      }
    >;

export type NamedAdmission<R> = [NonFiniteKeys<R> | Exclude<keyof R, string>] extends [never] ? unknown
  : Unsatisfied<'factory dependencies must be finite string-keyed objects', {}>;

type RequiredOf<R extends Registrations> = {
  [K in keyof R]: keyof Needs<R[K]>;
}[keyof R];

export type Complete<R extends Registrations> = [
  Exclude<RequiredOf<R>, keyof R> | MissingTokens<R>,
] extends [never]
  ? [InvalidGraphs<R>] extends [never] ? unknown
    : Unsatisfied<'token dependency has an incompatible or opaque contract', { tokens: InvalidGraphs<R> }>
  : Unsatisfied<
      'missing factories',
      { missing: Exclude<RequiredOf<R>, keyof R> | MissingTokens<R> }
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

export type Introduces<F extends Registrations, N extends Registrations> = [
  keyof F & keyof N,
] extends [never]
  ? unknown
  : Unsatisfied<
      'add introduces new tokens only',
      { duplicates: keyof F & keyof N }
    >;

export type Singleton<K> = [K] extends [never]
  ? false
  : [K] extends [string]
    ? true extends IsUnion<K>
      ? false
      : [NonFiniteKeys<Record<K & string, never>>] extends [never]
        ? true
        : false
    : false;

export type ReplacementKey<R extends Registrations, K extends string> =
  Singleton<K> extends true
    ? K extends keyof R
      ? unknown
      : InvalidReplacement<K>
    : InvalidReplacement<K>;

// Context needs one compatible output per surviving consumer. Intersect their
// callback parameters, not their value unions: string | number in one consumer
// must remain a union. The replaced factory's own old requirements disappear.
type ReplacementRequirement<N, K extends PropertyKey> = K extends keyof N
  ? (value: N[K]) => void : never;
type LocalReplacementRequirements<R extends Registrations, K extends PropertyKey> = {
  // Available slots are present: remove implicit optionality as Checked does,
  // while retaining explicitly declared undefined under exactOptionalPropertyTypes.
  [P in Exclude<keyof R, K>]: ReplacementRequirement<Required<Needs<R[P]>>, K>;
}[Exclude<keyof R, K>];
type RetainedReplacementRequirements<C, K extends PropertyKey> = C extends { readonly needs: infer N }
  // Retained module checks compare indexed values directly. Consumer labels
  // are not binding identities and cannot justify dropping a constraint.
  ? ReplacementRequirement<N, K> : never;
type ReplacementRequirements<R extends Registrations, K extends PropertyKey, C> =
  LocalReplacementRequirements<R, K> | RetainedReplacementRequirements<C, K>;
export type ReplacementOutput<R extends Registrations, K extends PropertyKey, C = never> =
  [ReplacementRequirements<R, K, C>] extends [never] ? unknown
    : ReplacementRequirements<R, K, C> extends (value: infer O) => void ? O : unknown;

type InvalidReplacement<K> = Unsatisfied<
  'replace requires one existing singleton string-literal key',
  { key: K }
>;

// Validate each tuple element, not K[number]: a multi-key tuple is valid even
// though the union of all of its elements is not itself a singleton.
type InvalidElements<K extends readonly unknown[]> = {
  [I in keyof K]-?: Singleton<K[I]> extends true ? never : ValidToken<K[I]> extends true ? never : I;
}[number];
type InvalidMembers<R extends Registrations, T> = T extends string ? never : unknown extends TokenMember<R, T> ? never : T;

export type Selection<R extends Registrations, K extends readonly unknown[], Operation extends string = 'fork'> =
  true extends IsUnion<K>
    ? InvalidSelection<Operation>
    : number extends K['length']
      ? InvalidSelection<Operation>
      : K extends Required<K>
        ? [InvalidElements<K>] extends [never]
          ? [Exclude<SelectionKey<K[number]>, keyof R> | InvalidMembers<R, K[number]>] extends [never]
            ? unknown
            : Unsatisfied<
                `${Operation} accepts existing tokens only`,
                { extra: Exclude<SelectionKey<K[number]>, keyof R> | InvalidMembers<R, K[number]> }
              >
          : InvalidSelection<Operation>
        : InvalidSelection<Operation>;

type InvalidSelection<Operation extends string> = Unsatisfied<
  `${Operation} requires a finite tuple of singleton string-literal keys`,
  { selection: 'use a const tuple with individually known keys' }
>;

export type Selected<K extends readonly unknown[], O> = {
  [P in Extract<SelectionKey<K[number]>, keyof O>]: Extract<O[P], Registration>;
};

// A graph-compatible bound gives context-sensitive factories a usable first
// inference pass, while requiring every selected key in explicit type arguments.
export type ForkContext<
  R extends Registrations,
  K extends readonly unknown[],
  O,
> = {
  [P in Extract<SelectionKey<K[number]>, keyof R>]:
    | ((
        this: void,
        deps: Provided<Merge<R, Selected<K, O>>>,
      ) => Provided<R>[P])
    | DisposableFactory<
        (
          this: void,
          deps: Provided<Merge<R, Selected<K, O>>>,
        ) => Provided<R>[P]
      >
    | ProviderContext<
        (this: void, deps: Provided<Merge<R, Selected<K, O>>>) => Provided<R>[P],
        P extends keyof O ? ProviderGraph<Extract<O[P], Registration>> : TokenGraph
      >;
};
