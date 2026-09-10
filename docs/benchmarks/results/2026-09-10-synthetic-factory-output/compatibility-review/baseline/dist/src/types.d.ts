import type { DisposableFactory, Registration, Registrations } from './registration';
import type { ProviderContext, ProviderNeeds, ProviderOutput, ProviderGraph, ProviderTokenNeeds, ProviderOptionalTokenNeeds } from './provider';
import type { InvalidGraphs, MissingTokens, SelectionKey, TokenMember, ValidToken, TokenGraph, WrongToken } from './token-types';
export type Needs<R extends Registration> = ProviderNeeds<R>;
/** Map registrations to the exact service values they expose. */
export type Provided<R extends Registrations> = {
    [K in keyof R]: ProviderOutput<R[K]>;
};
export type Entry = {
    key: string | symbol;
    registration: Registration;
};
/** Convert a registration map to the union of entries retained by a builder. */
export type Entries<R extends Registrations> = {
    [K in keyof R & (string | symbol)]: {
        key: K;
        registration: R[K];
    };
}[keyof R & (string | symbol)];
/** Reconstruct a registration map from a builder's retained entry union. */
export type From<E extends Entry> = {
    [P in E as P['key']]: P['registration'];
};
/** Replace overlapping registrations in `F` with registrations from `N`. */
export type Merge<F extends Registrations, N extends Registrations> = Omit<F, keyof N> & N;
declare const errorBrand: unique symbol;
export type Unsatisfied<Message extends string, Details> = {
    readonly [errorBrand]: Message;
} & Details;
type IsUnion<T, Whole = T> = T extends Whole ? [Whole] extends [T] ? false : true : never;
type NonFiniteKeys<T> = {
    [K in keyof T]-?: Record<never, never> extends Record<K, never> ? K : never;
}[keyof T];
type InvalidNeeds<R extends Registrations> = {
    [K in keyof R]: true extends IsUnion<Needs<R[K]>> ? K : Needs<R[K]> extends (...args: never[]) => unknown ? K : Needs<R[K]> extends abstract new (...args: never[]) => unknown ? K : [Needs<R[K]>] extends [object] ? [NonFiniteKeys<Needs<R[K]>>] extends [never] ? [Exclude<keyof Needs<R[K]>, string>] extends [never] ? never : K : K : K;
}[keyof R];
type WrongShapes<R extends Registrations> = {
    [K in keyof R]: Pick<Provided<R>, keyof Needs<R[K]> & keyof R> extends Pick<Needs<R[K]>, keyof Needs<R[K]> & keyof R> ? never : K;
}[keyof R];
/** Compile-time admission for finite dependency objects and compatible known services. */
export type Checked<R extends Registrations> = [
    InvalidNeeds<R> | NonFiniteKeys<R> | Extract<keyof R, number>
] extends [never] ? [InvalidGraphs<R>] extends [never] ? [WrongShapes<R>] extends [never] ? unknown : Unsatisfied<'a dependency has the wrong shape', {
    tokens: WrongShapes<R>;
}> : Unsatisfied<'token dependency has an incompatible or opaque contract', {
    tokens: InvalidGraphs<R>;
}> : Unsatisfied<'factory dependencies must be finite string-keyed objects', {
    tokens: InvalidNeeds<R> | NonFiniteKeys<R> | Exclude<keyof R, string>;
}>;
type NewWrong<E extends Entry, N extends Registrations> = {
    [K in keyof N]: [Exclude<keyof Needs<N[K]>, keyof N> & E['key']] extends [never] ? never : Pick<Provided<From<E>>, Exclude<keyof Needs<N[K]>, keyof N> & E['key']> extends Pick<Needs<N[K]>, Exclude<keyof Needs<N[K]>, keyof N> & E['key']> ? never : K;
}[keyof N];
type OldWrong<E extends Entry, N extends Registrations> = E extends Entry ? E['key'] extends keyof N ? never : Pick<Provided<N>, keyof Needs<E['registration']> & keyof N> extends Pick<Needs<E['registration']>, keyof Needs<E['registration']> & keyof N> ? never : E['key'] : never;
type NewTokenWrong<E extends Entry, N extends Registrations> = {
    [K in keyof N]: WrongToken<ProviderTokenNeeds<N[K]> | ProviderOptionalTokenNeeds<N[K]>, From<[E['key'] & keyof N] extends [never] ? E : Exclude<E, {
        key: keyof N;
    }>>>;
}[keyof N];
type OpaqueTokenNeeds<E extends Entry> = E extends Entry ? E['key'] extends never ? never : WrongToken<ProviderTokenNeeds<E['registration']> | ProviderOptionalTokenNeeds<E['registration']>, {}> : never;
type RetainedTokenNeeds<E extends Entry> = E extends Entry ? E['key'] extends never ? never : ProviderTokenNeeds<E['registration']> | ProviderOptionalTokenNeeds<E['registration']> : never;
type OldTokenWrong<E extends Entry, N extends Registrations> = [Extract<keyof N, symbol>] extends [never] ? OpaqueTokenNeeds<[E['key'] & keyof N] extends [never] ? E : Exclude<E, {
    key: keyof N;
}>> : string extends E['key'] ? E extends Entry ? E['key'] extends keyof N ? never : WrongToken<ProviderTokenNeeds<E['registration']> | ProviderOptionalTokenNeeds<E['registration']>, N> : never : [E['key']] extends [never] ? never : WrongToken<RetainedTokenNeeds<[E['key'] & keyof N] extends [never] ? E : Exclude<E, {
    key: keyof N;
}>>, N>;
export type IncrementalChecked<E extends Entry, N extends Registrations> = unknown extends Checked<N> ? [NewTokenWrong<E, N> | OldTokenWrong<E, N>] extends [never] ? [NewWrong<E, N> | OldWrong<E, N>] extends [never] ? unknown : Unsatisfied<'a dependency has the wrong shape', {
    tokens: NewWrong<E, N> | OldWrong<E, N>;
}> : Unsatisfied<'token dependency has an incompatible or opaque contract', {
    tokens: NewTokenWrong<E, N> | OldTokenWrong<E, N>;
}> : Checked<N>;
export type NamedAdmission<R> = [NonFiniteKeys<R> | Exclude<keyof R, string>] extends [never] ? unknown : Unsatisfied<'factory dependencies must be finite string-keyed objects', {}>;
type RequiredOf<R extends Registrations> = {
    [K in keyof R]: keyof Needs<R[K]>;
}[keyof R];
type CompletionMap<R extends Registrations> = {
    [K in keyof R]: R[K];
};
/** Compile-time admission requiring every named and typed-token dependency to be bound. */
export type Complete<R extends Registrations> = [
    Exclude<RequiredOf<R>, keyof R> | MissingTokens<CompletionMap<R>>
] extends [never] ? [InvalidGraphs<CompletionMap<R>>] extends [never] ? unknown : Unsatisfied<'token dependency has an incompatible or opaque contract', {
    tokens: InvalidGraphs<CompletionMap<R>>;
}> : Unsatisfied<'missing factories', {
    missing: Exclude<RequiredOf<R>, keyof R> | MissingTokens<CompletionMap<R>>;
}>;
type BadOverrides<F extends Registrations, O extends Registrations> = {
    [K in keyof O & keyof F]: Provided<O>[K] extends Provided<F>[K] ? never : K;
}[keyof O & keyof F];
/** Admit overrides only for existing keys whose service values remain assignable. */
export type Overrides<F extends Registrations, O extends Registrations> = [
    Exclude<keyof O, keyof F>
] extends [never] ? [BadOverrides<F, O>] extends [never] ? unknown : Unsatisfied<'override value is not assignable to the original token', {
    tokens: BadOverrides<F, O>;
}> : Unsatisfied<'fork accepts existing tokens only', {
    extra: Exclude<keyof O, keyof F>;
}>;
export type Introduces<F extends Registrations, N extends Registrations> = [
    keyof F & keyof N
] extends [never] ? unknown : Unsatisfied<'add introduces new tokens only', {
    duplicates: keyof F & keyof N;
}>;
export type EntryKeys<E extends Entry> = string extends E['key'] ? keyof From<E> : E['key'];
export type IntroducesKeys<Known extends PropertyKey, New extends PropertyKey> = [Known & New] extends [never] ? unknown : Unsatisfied<'add introduces new tokens only', {
    duplicates: Known & New;
}>;
export type Singleton<K> = [K] extends [never] ? false : [K] extends [string] ? true extends IsUnion<K> ? false : [NonFiniteKeys<Record<K & string, never>>] extends [never] ? true : false : false;
export type ReplacementKey<R extends Registrations, K extends string> = Singleton<K> extends true ? K extends keyof R ? unknown : Unsatisfied<'replace requires one existing singleton string-literal key', {
    key: K;
}> : Unsatisfied<'replace requires one existing singleton string-literal key', {
    key: K;
}>;
export type ReplacementKeyOf<Keys extends PropertyKey, K extends string> = Singleton<K> extends true ? K extends Keys ? unknown : Unsatisfied<'replace requires one existing singleton string-literal key', {
    key: K;
}> : Unsatisfied<'replace requires one existing singleton string-literal key', {
    key: K;
}>;
type ReplacementRequirement<N, K extends PropertyKey> = K extends keyof N ? (value: N[K]) => void : never;
type LocalReplacementRequirements<R extends Registrations, K extends PropertyKey> = {
    [P in Exclude<keyof R, K>]: ReplacementRequirement<Required<Needs<R[P]>>, K>;
}[Exclude<keyof R, K>];
type RetainedReplacementRequirements<C, K extends PropertyKey> = C extends {
    readonly needs: infer N;
} ? ReplacementRequirement<N, K> : never;
type ReplacementRequirements<R extends Registrations, K extends PropertyKey, C> = LocalReplacementRequirements<R, K> | RetainedReplacementRequirements<C, K>;
export type ReplacementOutput<R extends Registrations, K extends PropertyKey, C = never> = [
    ReplacementRequirements<R, K, C>
] extends [never] ? unknown : ReplacementRequirements<R, K, C> extends (value: infer O) => void ? O : unknown;
type InvalidElements<K extends readonly unknown[]> = {
    [I in keyof K]-?: Singleton<K[I]> extends true ? never : ValidToken<K[I]> extends true ? never : I;
}[number];
type InvalidMembers<R extends Registrations, T> = T extends string ? never : unknown extends TokenMember<R, T> ? never : T;
/** Validate a finite tuple of existing singleton names or genuine typed tokens. */
export type Selection<R extends Registrations, K extends readonly unknown[], Operation extends string = 'fork'> = true extends IsUnion<K> ? InvalidSelection<Operation> : number extends K['length'] ? InvalidSelection<Operation> : K extends Required<K> ? [InvalidElements<K>] extends [never] ? [Exclude<SelectionKey<K[number]>, keyof R> | InvalidMembers<R, K[number]>] extends [never] ? unknown : Unsatisfied<`${Operation} accepts existing tokens only`, {
    extra: Exclude<SelectionKey<K[number]>, keyof R> | InvalidMembers<R, K[number]>;
}> : InvalidSelection<Operation> : InvalidSelection<Operation>;
type InvalidSelection<Operation extends string> = Unsatisfied<`${Operation} requires a finite tuple of singleton string-literal keys`, {
    selection: 'use a const tuple with individually known keys';
}>;
/** Select registration-valued own fields corresponding to a checked key tuple. */
export type Selected<K extends readonly unknown[], O> = {
    [P in Extract<SelectionKey<K[number]>, keyof O>]: Extract<O[P], Registration>;
};
/** Contextual override shape used to infer a selected fork or child-scope graph. */
export type ForkContext<R extends Registrations, K extends readonly unknown[], O> = {
    [P in Extract<SelectionKey<K[number]>, keyof R>]: ((this: void, deps: Provided<Merge<R, Selected<K, O>>>) => Provided<R>[P]) | DisposableFactory<(this: void, deps: Provided<Merge<R, Selected<K, O>>>) => Provided<R>[P]> | ProviderContext<(this: void, deps: Provided<Merge<R, Selected<K, O>>>) => Provided<R>[P], P extends keyof O ? ProviderGraph<Extract<O[P], Registration>> : TokenGraph>;
};
export {};
