import type {
  Factory,
  FactoryWithDisposal,
  Registration,
  Registrations,
} from './registration';
import type { ProviderContext, ProviderNamedDependencies, ProviderOutput, ProviderGraphContract, ProviderRequiredTokens, ProviderOptionalTokens } from './provider';
import type { BindingOutput, InvalidGraphs, MissingTokens, SelectionKey, TokenBinding, TokenMember, TokenDependencyContract, TokenValue, ValidToken, WrongToken } from './token-types';
import type { CollectionTokenBase, TokenBase, TokenKey } from './tokens';
import type { CollectionMember } from './contribution-types';
import type { BoundToken } from './provider';

export type Needs<R extends Registration> = ProviderNamedDependencies<R>;

/**
 * Map registrations to the exact service values they expose.
 * @see https://dany-fedorov.github.io/di-bag/guides/api-reference.html#graph-composition-support-types
 */
export type ServicesOf<R extends Registrations> = {
  [K in keyof R]: ProviderOutput<R[K]>;
};

// Keep builder history flat; reconstruct a map only at graph-check boundaries.
export type Entry = { key: string | symbol; registration: Registration };

// Compare distinct keys before the registration types retained by an entry union.
type RegistrationEntry<K extends string | symbol, V extends Registration> = { key: K; registration: V };

/**
 * Convert a registration map to the union of entries retained by a builder.
 * @see https://dany-fedorov.github.io/di-bag/guides/api-reference.html#graph-composition-support-types
 */
export type RegistrationEntries<R extends Registrations> = {
  [K in keyof R & (string | symbol)]: RegistrationEntry<K, R[K]>;
}[keyof R & (string | symbol)];

/**
 * Reconstruct a registration map from a builder's retained entry union.
 * @see https://dany-fedorov.github.io/di-bag/guides/api-reference.html#graph-composition-support-types
 */
export type RegistrationsFromEntries<E extends Entry> = {
  [P in E as P['key']]: P['registration'];
};

/**
 * Replace overlapping registrations in `F` with registrations from `N`.
 * @see https://dany-fedorov.github.io/di-bag/guides/tutorial.html#fork-for-scopes-and-tests
 */
export type OverrideRegistrations<F extends Registrations, N extends Registrations> = Omit<
  F,
  keyof N
> &
  N;

/**
 * Project-wide compile-time policy switches. Augment it to relax a check:
 * `declare module 'di-bag' { interface DiBagPolicy { readonly structuralThenables: 'allow' } }`.
 * @see https://dany-fedorov.github.io/di-bag/guides/api-reference.html#graph-composition-support-types
 */
export interface DiBagPolicy {}
type StructuralThenablesAllowed = DiBagPolicy extends { readonly structuralThenables: 'allow' } ? true : false;
export type IsAny<T> = 0 extends 1 & T ? true : false;
/** True for a declared output with a callable `then` that is not a native Promise; `any` is exempt. */
export type StructuralThenable<O> = StructuralThenablesAllowed extends true ? false
  : IsAny<O> extends true ? false
    // Infer through an intersection first: a NoInfer wrapper otherwise defers the check in adapter signatures.
    : O extends infer T & {} ? T extends Promise<unknown> ? false : T extends { then(...args: never[]): unknown } ? true : false : false;
type ThenableOutputs<R extends Registrations> = {
  [K in keyof R]: R[K] extends Factory | FactoryWithDisposal<Factory> ? true extends StructuralThenable<ProviderOutput<R[K]>> ? K : never : never;
}[keyof R];
/** Reject plain or disposable factories whose declared output auto acquisition would reject at runtime. */
export type ThenableAdmission<R extends Registrations> = [ThenableOutputs<R>] extends [never] ? unknown
  : Unsatisfied<`factory output is a structural thenable: ${NameText<ThenableOutputs<R>>}; return a native Promise or use DiBag.fromFactory with acquisitionMode raw or nativePromise${SeeErrors<'structural-thenable'>}`, { tokens: ThenableOutputs<R> }>;

/**
 * Render dependency names inside diagnostic messages; typed tokens have no printable name.
 * Use it only in checks that run once per graph (build, module completeness, lifetimes, key selection):
 * per-call wrong-shape checks stay plain because templates there cost instantiations on valid graphs.
 */
export type NameText<K> = K extends string ? K : K extends number ? `${K}` : 'typed token';
// The errors page for compile-time messages; tests/message-urls.test.ts pins it to the runtime base in src/errors.ts.
export type ErrorsPage = 'https://dany-fedorov.github.io/di-bag/agent/errors.html';
/** Message suffix naming the errors-page section of a compile-time message family. */
export type SeeErrors<Family extends string> = `; see ${ErrorsPage}#${Family}`;
// Per-call wrong-shape sites stay unnamed for compiler cost; that section tells the reader to call verifyGraph().
export type WrongShapeMessage = `provided service does not satisfy its consumer dependency${SeeErrors<'wrong-shape'>}`;
declare const diBagTypeError: unique symbol;
export type Unsatisfied<Message extends string, Details> = {
  readonly [diBagTypeError]: Message;
} & Details;
// verifyGraph() prints the details a wrong-shape report points to, so its report names the unsatisfied-consumer section instead.
export type ConsumerReport<Check> = Check extends { readonly [diBagTypeError]: WrongShapeMessage }
  ? Unsatisfied<`provided service does not satisfy its consumer dependency${SeeErrors<'unsatisfied-consumer'>}`, Omit<Check, typeof diBagTypeError>>
  : Check;

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

/**
 * Compile-time admission for finite dependency objects and compatible known services.
 * @see https://dany-fedorov.github.io/di-bag/agent/errors.html#unsatisfied-consumer
 */
export type CheckDependencyCompatibility<R extends Registrations> = [
  InvalidNeeds<R> | NonFiniteKeys<R> | Extract<keyof R, number>,
] extends [never]
  ? [InvalidGraphs<R>] extends [never] ? [WrongShapes<R>] extends [never]
    ? unknown
    : Unsatisfied<WrongShapeMessage, { tokens: WrongShapes<R>; relationships: WrongRelationships<R, WrongShapes<R>> }>
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
      : Unsatisfied<WrongShapeMessage, { tokens: NewWrong<E, N> | OldWrong<E, N>; relationships: WrongRelationships<OverrideRegistrations<RegistrationsFromEntries<E>, N>, (NewWrong<E, N> | OldWrong<E, N>) & keyof OverrideRegistrations<RegistrationsFromEntries<E>, N>> }>
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

/**
 * Compile-time admission requiring every named and typed-token dependency to be bound.
 * @see https://dany-fedorov.github.io/di-bag/agent/errors.html#missing-service
 */
export type CheckDependencyCompleteness<R extends Registrations> = [
  Exclude<RequiredOf<R>, keyof R> | MissingTokens<CompletionMap<R>>,
] extends [never]
  ? [InvalidGraphs<CompletionMap<R>>] extends [never] ? unknown
    : Unsatisfied<'token dependency has an incompatible or opaque contract', { tokens: InvalidGraphs<CompletionMap<R>> }>
  : Unsatisfied<
      `required service registrations are missing: ${NameText<Exclude<RequiredOf<R>, keyof R> | MissingTokens<CompletionMap<R>>>}${SeeErrors<'missing-service'>}`,
      { missing: Exclude<RequiredOf<R>, keyof R> | MissingTokens<CompletionMap<R>>; relationships: MissingRelationships<R> }
    >;

type BadOverrides<F extends Registrations, O extends Registrations> = {
  [K in keyof O & keyof F]: ServicesOf<O>[K] extends ServicesOf<F>[K] ? never : K;
}[keyof O & keyof F];

/**
 * Admit overrides only for existing keys whose service values remain assignable.
 * @see https://dany-fedorov.github.io/di-bag/guides/tutorial.html#fork-for-scopes-and-tests
 */
export type Overrides<
  F extends Registrations,
  O extends Registrations,
  K extends readonly unknown[] = readonly [],
> = unknown extends CollectionOverrideAdmission<K, O>
  ? [Exclude<keyof O, keyof SelectionRegistrations<F, K>>] extends [never]
    ? [BadOverrides<SelectionRegistrations<F, K>, O>] extends [never]
      ? unknown
      : Unsatisfied<
          `override value is not assignable to the original token: ${NameText<BadOverrides<SelectionRegistrations<F, K>, O>>}${SeeErrors<'wrong-override'>}`,
          { tokens: BadOverrides<SelectionRegistrations<F, K>, O> }
        >
    : Unsatisfied<
        `fork accepts existing names or typed tokens only: unknown ${NameText<Exclude<keyof O, keyof SelectionRegistrations<F, K>>>}${SeeErrors<'unknown-key'>}`,
        { extra: Exclude<keyof O, keyof SelectionRegistrations<F, K>> }
      >
  : CollectionOverrideAdmission<K, O>;

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
      : Unsatisfied<`replace requires one existing singleton string-literal key: ${NameText<K>}${SeeErrors<'unknown-key'>}`, { key: K }>
    : Unsatisfied<`replace requires one existing singleton string-literal key: ${NameText<K>}${SeeErrors<'unknown-key'>}`, { key: K }>;

export type ReplacementKeyOf<Keys extends PropertyKey, K extends string> =
  Singleton<K> extends true
    ? K extends Keys
      ? unknown
      : Unsatisfied<`replace requires one existing singleton string-literal key: ${NameText<K>}${SeeErrors<'unknown-key'>}`, { key: K }>
    : Unsatisfied<`replace requires one existing singleton string-literal key: ${NameText<K>}${SeeErrors<'unknown-key'>}`, { key: K }>;

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
type InvalidSelectionElements<K extends readonly unknown[]> = {
  [I in keyof K]-?: Singleton<K[I]> extends true ? never : ValidToken<K[I]> extends true ? never : I;
}[number];
type InvalidSelectionMembers<R extends Registrations, C, T> = T extends string ? never
  : T extends CollectionTokenBase ? unknown extends CollectionMember<T, C> ? never : T
  : unknown extends TokenMember<R, T> ? never : T;
type MissingSelectionKeys<R extends Registrations, T> = T extends CollectionTokenBase ? never : Exclude<SelectionKey<T>, keyof R>;

/**
 * Validate a finite tuple of existing singleton names or genuine typed tokens.
 * @see https://dany-fedorov.github.io/di-bag/guides/tutorial.html#fork-for-scopes-and-tests
 */
export type Selection<R extends Registrations, C, K extends readonly unknown[], Operation extends string = 'fork'> =
  true extends IsUnion<K>
    ? InvalidSelection<Operation>
    : number extends K['length']
      ? InvalidSelection<Operation>
      : K extends Required<K>
        ? [InvalidSelectionElements<K>] extends [never]
          ? [MissingSelectionKeys<R, K[number]> | InvalidSelectionMembers<R, C, K[number]>] extends [never]
            ? unknown
            : Unsatisfied<
                `${Operation} accepts existing names or typed tokens only: unknown ${NameText<MissingSelectionKeys<R, K[number]> | InvalidSelectionMembers<R, C, K[number]>>}${SeeErrors<'unknown-key'>}`,
                { extra: MissingSelectionKeys<R, K[number]> | InvalidSelectionMembers<R, C, K[number]> }
              >
          : InvalidSelection<Operation>
        : InvalidSelection<Operation>;

type InvalidSelection<Operation extends string> = Unsatisfied<
  `${Operation} requires a finite tuple of singleton string-literal names or typed tokens${SeeErrors<'unknown-key'>}`,
  { selection: 'use a const tuple with individually known names or typed tokens' }
>;

/**
 * Select registration-valued own fields corresponding to a checked key tuple.
 * @see https://dany-fedorov.github.io/di-bag/guides/tutorial.html#fork-for-scopes-and-tests
 */
export type SelectedRegistrations<K extends readonly unknown[], O> = {
  [P in Extract<SelectionKey<K[number]>, keyof O>]: Extract<O[P], Registration>;
};
type CollectionSelectionMember<V> = V extends CollectionTokenBase ? Record<TokenKey<V>, () => TokenValue<V>> : never;
export type CollectionSelection<K extends readonly unknown[]> = [Extract<K[number], CollectionTokenBase>] extends [never] ? {}
  : Intersect<CollectionSelectionMember<K[number]>> extends infer Exact extends object
    ? { [P in keyof Exact]: Extract<Exact[P], Registration> }
    : never;
export type SelectionRegistrations<R extends Registrations, K extends readonly unknown[]> =
  Extract<Omit<R, keyof CollectionSelection<K>> & CollectionSelection<K>, Registrations>;
type SelectedTokenForKey<K extends readonly unknown[], P extends PropertyKey> = K[number] extends infer V ? V extends TokenBase ? TokenKey<V> extends P ? V : never : never : never;
type OverrideOutput<Base extends Registrations, K extends readonly unknown[], P extends keyof Base> =
  P extends TokenKey<Extract<K[number], CollectionTokenBase>>
    ? unknown
    : ServicesOf<Base>[P];
type CollectionOverrideMember<O, T> = T extends CollectionTokenBase
  ? TokenKey<T> extends keyof O ? BindingOutput<T, Extract<O[TokenKey<T>], Registration>> : unknown
  : unknown;
export type CollectionOverrideAdmission<K extends readonly unknown[], O> = Intersect<
  K[number] extends infer T ? CollectionOverrideMember<O, T> : never
>;
/** Rebind selected symbol-keyed overrides to their original typed-token contracts. */
export type ReboundProviders<R extends Registrations, K extends readonly unknown[], O extends Registrations> = {
  [P in keyof O]: P extends symbol ? SelectedTokenForKey<K, P> extends infer T extends TokenBase
    ? [T] extends [never] ? P extends keyof R ? TokenBinding<BoundToken<R[P]>, O[P]> : O[P]
      : TokenBinding<T, O[P]> : never : O[P];
};
/** Preserve named overrides while rebinding selected symbol-keyed providers. */
export type ReboundSelection<R extends Registrations, K extends readonly unknown[], O extends Registrations> =
  [Extract<keyof O, symbol>] extends [never] ? O : ReboundProviders<R, K, O>;
export type ReboundSelected<R extends Registrations, K extends readonly unknown[], O> = ReboundSelection<
  SelectionRegistrations<R, K>, K, SelectedRegistrations<K, O>
>;
export type AppliedSelection<R extends Registrations, K extends readonly unknown[], O> = OverrideRegistrations<
  SelectionRegistrations<R, K>, ReboundSelected<R, K, O>
>;

// A graph-compatible bound gives context-sensitive factories a usable first
// inference pass, while requiring every selected key in explicit type arguments.
/**
 * Contextual override shape used to infer a selected fork or child-scope graph.
 * @see https://dany-fedorov.github.io/di-bag/guides/tutorial.html#fork-for-scopes-and-tests
 */
export type OverrideFactoryContext<
  R extends Registrations,
  K extends readonly unknown[],
  O,
> = {
  [P in Extract<SelectionKey<K[number]>, keyof SelectionRegistrations<R, K>>]:
    | ((
        this: void,
        dependencies: ServicesOf<AppliedSelection<R, K, O>>,
      ) => OverrideOutput<SelectionRegistrations<R, K>, K, P>)
    | FactoryWithDisposal<
        (
          this: void,
          dependencies: ServicesOf<AppliedSelection<R, K, O>>,
        ) => OverrideOutput<SelectionRegistrations<R, K>, K, P>
      >
    | ProviderContext<
        (this: void, dependencies: ServicesOf<AppliedSelection<R, K, O>>) => OverrideOutput<SelectionRegistrations<R, K>, K, P>,
        P extends keyof O ? ProviderGraphContract<Extract<O[P], Registration>> : TokenDependencyContract
      >;
};

// Declaration emit prints a type through the alias it was instantiated from, and an alias the
// package index does not export cannot be named by consumers. A resolved conditional branch carries
// no alias, so these helpers answer through one and print as plain object types.
/** Force a projection to print as a resolved object type in declarations. */
export type Resolved<T> = T extends object ? { [K in keyof T]: T[K] } : T;
export type Intersect<U> = (U extends unknown ? (value: U) => void : never) extends (value: infer I) => void ? I : never;
// Declaration emit cannot serialize an expanded property named by a unique symbol, so symbol keys
// stay `Record` references, which print by name and carry only the key and service types.
type SymbolExports<S, K> = Extract<Intersect<K extends symbol ? Record<K, S[K & keyof S]> : never>, object>;
/** The services a sealed module exports, printed without the registrations they came from. */
// Single-kind selections skip the intersection: installs compare this type on every call.
export type ExportedServices<S, K extends keyof S> = [Extract<K, symbol>] extends [never] ? Resolved<Pick<S, K>>
  : [Extract<K, string>] extends [never] ? SymbolExports<S, K>
  : Resolved<Pick<S, Extract<K, string>>> & SymbolExports<S, K>;
