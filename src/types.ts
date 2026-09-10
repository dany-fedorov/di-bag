import type {
  FactoryWithDisposal,
  Registration,
  Registrations,
} from './registration';
import type { ProviderContext, ProviderNamedDependencies, ProviderOutput, ProviderGraphContract, ProviderRequiredTokens, ProviderOptionalTokens } from './provider';
import type { InvalidGraphs, MissingTokens, SelectionKey, TokenMember, ValidToken, TokenDependencyContract, WrongToken } from './token-types';

export type Needs<R extends Registration> = ProviderNamedDependencies<R>;

/** Map registrations to the exact service values they expose. */
export type ServicesOf<R extends Registrations> = {
  [K in keyof R]: ProviderOutput<R[K]>;
};

// Keep builder history flat; reconstruct a map only at graph-check boundaries.
export type Entry = { key: string | symbol; registration: Registration };

// Compare distinct keys before the registration types retained by an entry union.
type RegistrationEntry<K extends string | symbol, V extends Registration> = { key: K; registration: V };

/** Convert a registration map to the union of entries retained by a builder. */
export type RegistrationEntries<R extends Registrations> = {
  [K in keyof R & (string | symbol)]: RegistrationEntry<K, R[K]>;
}[keyof R & (string | symbol)];

/** Reconstruct a registration map from a builder's retained entry union. */
export type RegistrationsFromEntries<E extends Entry> = {
  [P in E as P['key']]: P['registration'];
};

/** Replace overlapping registrations in `F` with registrations from `N`. */
export type OverrideRegistrations<F extends Registrations, N extends Registrations> = Omit<
  F,
  keyof N
> &
  N;

declare const diBagTypeError: unique symbol;
export type Unsatisfied<Message extends string, Details> = {
  readonly [diBagTypeError]: Message;
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
  [K in keyof R]: Pick<ServicesOf<R>, keyof Needs<R[K]> & keyof R> extends Pick<
    Needs<R[K]>,
    keyof Needs<R[K]> & keyof R
  >
    ? never
    : K;
}[keyof R];

// Expanded relationships appear only in failure branches; successful checks retain their fast predicates.
type WrongRelationships<R extends Registrations, Consumers extends keyof R> = {
  [Consumer in Consumers]: {
    [DependencyReference in keyof Needs<R[Consumer]> & keyof R]: ServicesOf<R>[DependencyReference] extends Required<Needs<R[Consumer]>>[DependencyReference]
      ? never : { consumer: Consumer; dependency: DependencyReference; expected: Required<Needs<R[Consumer]>>[DependencyReference]; provided: ServicesOf<R>[DependencyReference] }
  }[keyof Needs<R[Consumer]> & keyof R]
}[Consumers];
type MissingRelationships<R extends Registrations> = {
  [Consumer in keyof R]: {
    [DependencyReference in Exclude<keyof Needs<R[Consumer]>, keyof R>]: { consumer: Consumer; dependency: DependencyReference; expected: Needs<R[Consumer]>[DependencyReference]; provided: undefined }
  }[Exclude<keyof Needs<R[Consumer]>, keyof R>]
}[keyof R];

/** Compile-time admission for finite dependency objects and compatible known services. */
export type CheckDependencyCompatibility<R extends Registrations> = [
  InvalidNeeds<R> | NonFiniteKeys<R> | Extract<keyof R, number>,
] extends [never]
  ? [InvalidGraphs<R>] extends [never] ? [WrongShapes<R>] extends [never]
    ? unknown
    : Unsatisfied<'provided service does not satisfy its consumer dependency', { tokens: WrongShapes<R>; relationships: WrongRelationships<R, WrongShapes<R>> }>
    : Unsatisfied<'token dependency has an incompatible or opaque contract', { tokens: InvalidGraphs<R> }>
  : [NonFiniteKeys<R> | Extract<keyof R, number>] extends [never]
    ? Unsatisfied<'factory dependencies must be finite string-keyed objects', { tokens: InvalidNeeds<R> }>
    : Unsatisfied<'registration keys must be finite string or unique-symbol keys', { keys: NonFiniteKeys<R> | Extract<keyof R, number> }>;

// Builder history has already passed CheckDependencyCompatibility, so only relationships crossing
// the accepted-history/incoming-registration boundary need validating again.
type NewWrong<E extends Entry, N extends Registrations> = {
  [K in keyof N]: [Exclude<keyof Needs<N[K]>, keyof N> & E['key']] extends [never] ? never
    : Pick<ServicesOf<RegistrationsFromEntries<E>>, Exclude<keyof Needs<N[K]>, keyof N> & E['key']> extends
      Pick<Needs<N[K]>, Exclude<keyof Needs<N[K]>, keyof N> & E['key']> ? never : K
}[keyof N];
type OldWrong<E extends Entry, N extends Registrations> = E extends Entry
  ? E['key'] extends keyof N ? never
    : Pick<ServicesOf<N>, keyof Needs<E['registration']> & keyof N> extends
      Pick<Needs<E['registration']>, keyof Needs<E['registration']> & keyof N> ? never : E['key']
  : never;
type NewTokenWrong<E extends Entry, N extends Registrations> = {
  [K in keyof N]: WrongToken<ProviderRequiredTokens<N[K]> | ProviderOptionalTokens<N[K]>, RegistrationsFromEntries<[E['key'] & keyof N] extends [never] ? E : Exclude<E, { key: keyof N }>>>
}[keyof N];
// Without incoming symbol keys, only opaque token needs can fail. Cache that
// check per retained entry while preserving removal of replaced registrations.
type OpaqueTokenNeeds<E extends Entry> = E extends Entry
  ? E['key'] extends never ? never : WrongToken<ProviderRequiredTokens<E['registration']> | ProviderOptionalTokens<E['registration']>, {}> : never;
// Cache extraction per retained entry before comparing incoming token bindings.
type RetainedTokenNeeds<E extends Entry> = E extends Entry
  ? E['key'] extends never ? never : ProviderRequiredTokens<E['registration']> | ProviderOptionalTokens<E['registration']> : never;
// Broad histories preserve conditional any-key behavior; empty keys must reduce
// before a generic registration can defer the cached comparison.
type OldTokenWrong<E extends Entry, N extends Registrations> = [Extract<keyof N, symbol>] extends [never]
  ? OpaqueTokenNeeds<[E['key'] & keyof N] extends [never] ? E : Exclude<E, { key: keyof N }>> : string extends E['key'] ? E extends Entry
    ? E['key'] extends keyof N ? never : WrongToken<ProviderRequiredTokens<E['registration']> | ProviderOptionalTokens<E['registration']>, N> : never
    : [E['key']] extends [never] ? never : WrongToken<RetainedTokenNeeds<[E['key'] & keyof N] extends [never] ? E : Exclude<E, { key: keyof N }>>, N>;
// Preserve CheckDependencyCompatibility's incoming-first precedence before inspecting cross-boundary
// relationships, then prefer token-contract errors over named shape errors.
export type IncrementalChecked<E extends Entry, N extends Registrations> = unknown extends CheckDependencyCompatibility<N>
  ? [NewTokenWrong<E, N> | OldTokenWrong<E, N>] extends [never]
    ? [NewWrong<E, N> | OldWrong<E, N>] extends [never] ? unknown
      : Unsatisfied<'provided service does not satisfy its consumer dependency', { tokens: NewWrong<E, N> | OldWrong<E, N>; relationships: WrongRelationships<OverrideRegistrations<RegistrationsFromEntries<E>, N>, (NewWrong<E, N> | OldWrong<E, N>) & keyof OverrideRegistrations<RegistrationsFromEntries<E>, N>> }>
    : Unsatisfied<'token dependency has an incompatible or opaque contract', { tokens: NewTokenWrong<E, N> | OldTokenWrong<E, N> }>
  : CheckDependencyCompatibility<N>;

export type NamedAdmission<R> = [NonFiniteKeys<R> | Exclude<keyof R, string>] extends [never] ? unknown
  : Unsatisfied<'register requires finite string-keyed registration objects', { keys: NonFiniteKeys<R> | Exclude<keyof R, string> }>;

type RequiredOf<R extends Registrations> = {
  [K in keyof R]: keyof Needs<R[K]>;
}[keyof R];

// Cache the key union once for token graph checks. Remapped builder histories
// otherwise repeat their key projection for every required token.
type CompletionMap<R extends Registrations> = { [K in keyof R]: R[K] };

/** Compile-time admission requiring every named and typed-token dependency to be bound. */
export type CheckDependencyCompleteness<R extends Registrations> = [
  Exclude<RequiredOf<R>, keyof R> | MissingTokens<CompletionMap<R>>,
] extends [never]
  ? [InvalidGraphs<CompletionMap<R>>] extends [never] ? unknown
    : Unsatisfied<'token dependency has an incompatible or opaque contract', { tokens: InvalidGraphs<CompletionMap<R>> }>
  : Unsatisfied<
      'required service registrations are missing',
      { missing: Exclude<RequiredOf<R>, keyof R> | MissingTokens<CompletionMap<R>>; relationships: MissingRelationships<R> }
    >;

type BadOverrides<F extends Registrations, O extends Registrations> = {
  [K in keyof O & keyof F]: ServicesOf<O>[K] extends ServicesOf<F>[K] ? never : K;
}[keyof O & keyof F];

/** Admit overrides only for existing keys whose service values remain assignable. */
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
      'fork accepts existing names or typed tokens only',
      { extra: Exclude<keyof O, keyof F> }
    >;

export type Introduces<F extends Registrations, N extends Registrations> = [
  keyof F & keyof N,
] extends [never]
  ? unknown
  : Unsatisfied<
      'register introduces new names or typed tokens only',
      { duplicates: keyof F & keyof N }
    >;

// Finite histories already carry their exact key union. Reconstruct broad
// string histories so their implicit numeric index and opaque key shapes survive.
export type EntryKeys<E extends Entry> = string extends E['key'] ? keyof RegistrationsFromEntries<E> : E['key'];

// Duplicate admission needs keys, independently of registration values.
export type IntroducesKeys<Known extends PropertyKey, New extends PropertyKey> = [Known & New] extends [never]
 ? unknown : Unsatisfied<'register introduces new names or typed tokens only', { duplicates: Known & New }>;

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
      : Unsatisfied<'replace requires one existing singleton string-literal key', { key: K }>
    : Unsatisfied<'replace requires one existing singleton string-literal key', { key: K }>;

export type ReplacementKeyOf<Keys extends PropertyKey, K extends string> =
  Singleton<K> extends true
    ? K extends Keys
      ? unknown
      : Unsatisfied<'replace requires one existing singleton string-literal key', { key: K }>
    : Unsatisfied<'replace requires one existing singleton string-literal key', { key: K }>;

// Context needs one compatible output per surviving consumer. Intersect their
// callback parameters, not their value unions: string | number in one consumer
// must remain a union. The replaced factory's own old requirements disappear.
type ReplacementRequirement<N, K extends PropertyKey> = K extends keyof N
  ? (value: N[K]) => void : never;
// Distribute keys without allocating properties for absent requirements. Keep
// union-valued registrations grouped, removing only implicit needs optionality.
type LocalReplacementRequirement<R extends Registrations, K extends PropertyKey, P extends keyof R> =
  P extends unknown ? ReplacementRequirement<Required<Needs<R[P]>>, K> : never;
type LocalReplacementRequirements<R extends Registrations, K extends PropertyKey> =
  LocalReplacementRequirement<R, K, Exclude<keyof R, K>>;
type RetainedReplacementRequirements<C, K extends PropertyKey> = C extends { readonly needs: infer N }
  // Retained module checks compare indexed values directly. Consumer labels
  // are not binding identities and cannot justify dropping a constraint.
  ? ReplacementRequirement<N, K> : never;
type ReplacementRequirements<R extends Registrations, K extends PropertyKey, C> =
  LocalReplacementRequirements<R, K> | RetainedReplacementRequirements<C, K>;
export type ReplacementOutput<R extends Registrations, K extends PropertyKey, C = never> =
  [ReplacementRequirements<R, K, C>] extends [never] ? unknown
    : ReplacementRequirements<R, K, C> extends (value: infer O) => void ? O : unknown;

// Validate each tuple element, not K[number]: a multi-key tuple is valid even
// though the union of all of its elements is not itself a singleton.
type InvalidElements<K extends readonly unknown[]> = {
  [I in keyof K]-?: Singleton<K[I]> extends true ? never : ValidToken<K[I]> extends true ? never : I;
}[number];
type InvalidMembers<R extends Registrations, T> = T extends string ? never : unknown extends TokenMember<R, T> ? never : T;

/** Validate a finite tuple of existing singleton names or genuine typed tokens. */
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
                `${Operation} accepts existing names or typed tokens only`,
                { extra: Exclude<SelectionKey<K[number]>, keyof R> | InvalidMembers<R, K[number]> }
              >
          : InvalidSelection<Operation>
        : InvalidSelection<Operation>;

type InvalidSelection<Operation extends string> = Unsatisfied<
  `${Operation} requires a finite tuple of singleton string-literal names or typed tokens`,
  { selection: 'use a const tuple with individually known names or typed tokens' }
>;

/** Select registration-valued own fields corresponding to a checked key tuple. */
export type SelectedRegistrations<K extends readonly unknown[], O> = {
  [P in Extract<SelectionKey<K[number]>, keyof O>]: Extract<O[P], Registration>;
};

// A graph-compatible bound gives context-sensitive factories a usable first
// inference pass, while requiring every selected key in explicit type arguments.
/** Contextual override shape used to infer a selected fork or child-scope graph. */
export type OverrideFactoryContext<
  R extends Registrations,
  K extends readonly unknown[],
  O,
> = {
  [P in Extract<SelectionKey<K[number]>, keyof R>]:
    | ((
        this: void,
        deps: ServicesOf<OverrideRegistrations<R, SelectedRegistrations<K, O>>>,
      ) => ServicesOf<R>[P])
    | FactoryWithDisposal<
        (
          this: void,
          deps: ServicesOf<OverrideRegistrations<R, SelectedRegistrations<K, O>>>,
        ) => ServicesOf<R>[P]
      >
    | ProviderContext<
        (this: void, deps: ServicesOf<OverrideRegistrations<R, SelectedRegistrations<K, O>>>) => ServicesOf<R>[P],
        P extends keyof O ? ProviderGraphContract<Extract<O[P], Registration>> : TokenDependencyContract
      >;
};
