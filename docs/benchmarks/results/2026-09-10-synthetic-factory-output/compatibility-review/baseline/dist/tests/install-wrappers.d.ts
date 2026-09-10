import type { Builder, Module, Entries, From } from '../src';
import type { Entry, EntryKeys, IntroducesKeys, IncrementalChecked } from '../src/types';
import type { Registrations } from '../src/registration';
import type { NeedConstraint, IncrementalConstraints } from '../src/module-types';
export declare function install<E extends Entry, C extends NeedConstraint, P extends object, R extends object, MC extends NeedConstraint, D extends Registrations>(builder: Builder<E, C>, module: Module<P, R, MC, D> & IntroducesKeys<EntryKeys<E>, keyof D> & IncrementalChecked<E, D> & IncrementalConstraints<C, MC, From<E>, D>): Builder<E | Entries<D>, C | MC>;
export declare function installEmpty<P extends object, R extends object, MC extends NeedConstraint, D extends Registrations>(builder: Builder<never>, module: Module<P, R, MC, D> & IntroducesKeys<EntryKeys<never>, keyof D> & IncrementalChecked<never, D> & IncrementalConstraints<never, MC, From<never>, D>): Builder<Entries<D>, MC>;
export declare function installInferred<E extends Entry, C extends NeedConstraint, P extends object, R extends object, MC extends NeedConstraint, D extends Registrations>(builder: Builder<E, C>, module: Module<P, R, MC, D> & IntroducesKeys<EntryKeys<E>, keyof D> & IncrementalChecked<E, D> & IncrementalConstraints<C, MC, From<E>, D>): Builder<E | Entries<D>, C | MC>;
export declare const module: Module<Pick<import("../src").Provided<From<{
    key: "value";
    registration: () => number;
}>>, "value">, Readonly<{}>, never, import("../src").ModulePublicProviders<From<{
    key: "value";
    registration: () => number;
}>, "value">>;
export declare const original: Builder<{
    key: "value";
    registration: () => number;
}, never>;
export declare const wrapped: Builder<{
    key: "value";
    registration: () => number;
}, never>;
export declare const explicit: Builder<Entries<{
    value: () => number;
}>>;
export declare const inferred: Builder<{
    key: "value";
    registration: () => number;
}, never>;
export declare const value: number;
export declare const inferredValue: number;
