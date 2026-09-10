import { fromTokens } from '../src/provider';
import type { Dependency } from '../src/dependency-references';
import type { Provider, ProviderFactory, ProviderOutput, ProviderAcquired, ProviderNeeds, ProviderMetadata } from '../src/provider';
import type { TokenBase } from '../src/tokens';
import type { TokenArguments, TokenTupleAdmission, DependencyTupleAdmission, TokenGraph, ReferenceGraph } from '../src/token-types';
import type { AcquisitionMode, Acquired, StageOptions } from '../src/acquisition-mode';
import type { Registration, Registrations } from '../src/registration';
import type { PublicProvider, PublicProviders, ModulePublicProviders } from '../src/module-types';
import type { PublicProvider as LegacyPublicProvider, PublicProviders as LegacyPublicProviders, ModulePublicProviders as LegacyModulePublicProviders } from './legacy-module-types';
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Assert<T extends true> = T;
type Old<F extends (...args: any[]) => any, T extends readonly TokenBase[] = readonly [], M extends AcquisitionMode = 'auto'> = Provider<() => ReturnType<F>, Readonly<{}>, readonly [], TokenGraph<T>, Acquired<ReturnType<F>, M>>;
type Reflected<T> = ReturnType<typeof fromTokens<readonly [], () => T>>;
export declare function deferredFactory<F extends () => unknown>(callback: F): Old<F>;
export declare function deferredBack<F extends () => unknown>(provider: Old<F>): ReturnType<typeof fromTokens<readonly [], F>>;
export declare function deferredToOld<F extends () => unknown>(provider: ReturnType<typeof fromTokens<readonly [], F>>): Old<F>;
export declare function deferredOutput<F extends () => unknown>(value: ProviderFactory<ReturnType<typeof fromTokens<readonly [], F>>>): () => ReturnType<F>;
export declare function deferredOutputBack<F extends () => unknown>(value: () => ReturnType<F>): ProviderFactory<ReturnType<typeof fromTokens<readonly [], F>>>;
export declare function deferredValue<T>(value: ProviderOutput<Reflected<T>>): T;
export declare function deferredValueBack<T>(value: T): ProviderOutput<Reflected<T>>;
export declare function deferredMode<F extends () => ('native' extends M ? Promise<unknown> : unknown), M extends AcquisitionMode>(callback: F, ...options: StageOptions<M>): Old<F, readonly [], M>;
export declare function deferredTokens<T extends readonly TokenBase[], F extends (this: void, ...args: TokenArguments<NoInfer<T>>) => unknown>(tokens: T & TokenTupleAdmission<T>, callback: F): Provider<() => ReturnType<F>, Readonly<{}>, readonly [], ReferenceGraph<T>, Awaited<ReturnType<F>>>;
export declare function deferredRefs<T extends readonly Dependency[], F extends (this: void, ...args: TokenArguments<NoInfer<T>>) => unknown>(tokens: T & DependencyTupleAdmission<T>, callback: F): Provider<() => ReturnType<F>, Readonly<{}>, readonly [], ReferenceGraph<T>, Awaited<ReturnType<F>>>;
export declare function publicToOld<R extends Registration>(value: PublicProvider<R>): LegacyPublicProvider<R>;
export declare function publicFromOld<R extends Registration>(value: LegacyPublicProvider<R>): PublicProvider<R>;
export declare function publicMapToOld<R extends object>(value: PublicProviders<R>): LegacyPublicProviders<R>;
export declare function publicMapFromOld<R extends object>(value: LegacyPublicProviders<R>): PublicProviders<R>;
export declare function publicModuleToOld<R extends Registrations, K extends keyof R>(value: ModulePublicProviders<R, K>): LegacyModulePublicProviders<R, K>;
export declare function publicModuleFromOld<R extends Registrations, K extends keyof R>(value: LegacyModulePublicProviders<R, K>): ModulePublicProviders<R, K>;
export declare const inferredLiteral: 1;
export declare const inferredObject: {
    kind: 'value';
};
export declare const inferredPromise: Promise<42>;
export declare const inferredFunction: {
    kind: 'callback';
};
export declare const inferredFromProvider: {
    kind: 'provider';
};
export declare const inferredFromPublic: {
    kind: 'public';
};
export declare const inferredFromPublicOutput: unknown;
export declare const numberKey: unique symbol;
export declare const numberToken: import("../src").Token<typeof numberKey, number>;
export declare const promiseKey: unique symbol;
export declare const promiseToken: import("../src").Token<typeof promiseKey, Promise<42>>;
export declare const outputKey: unique symbol;
export declare const outputToken: import("../src").Token<typeof outputKey, {
    value: number;
}>;
export declare const literal: Provider<() => 42, Readonly<{}>, readonly [], TokenGraph<readonly [], never, readonly []>, 42>;
export declare const promised: Provider<() => Promise<42>, Readonly<{}>, readonly [], TokenGraph<readonly [], never, readonly []>, 42>;
export declare const raw: Provider<() => Promise<42>, Readonly<{}>, readonly [], TokenGraph<readonly [], never, readonly []>, Promise<42>>;
export declare const native: Provider<() => Promise<42>, Readonly<{}>, readonly [], TokenGraph<readonly [], never, readonly []>, 42>;
export declare const functional: Provider<() => (value: number) => string, Readonly<{}>, readonly [], TokenGraph<readonly [], never, readonly []>, (value: number) => string>;
export declare const anyOutput: Provider<() => any, Readonly<{}>, readonly [], TokenGraph<readonly [], never, readonly []>, any>;
export declare const neverOutput: Provider<() => never, Readonly<{}>, readonly [], TokenGraph<readonly [], never, readonly []>, never>;
export declare const unknownOutput: Provider<() => unknown, Readonly<{}>, readonly [], TokenGraph<readonly [], never, readonly []>, unknown>;
export declare const contextual: Provider<() => {
    number: number;
    promise: Promise<42>;
}, Readonly<{}>, readonly [], TokenGraph<readonly [import("../src").Token<typeof numberKey, number>, import("../src").Token<typeof promiseKey, Promise<42>>], never, readonly []>, {
    number: number;
    promise: Promise<42>;
}>;
export declare const references: Provider<() => {
    number: number;
    promise: Promise<42> | undefined;
    lazyNumber: () => number;
    numbers: readonly number[];
}, Readonly<{}>, readonly [], TokenGraph<readonly [import("../src").Token<typeof numberKey, number>, import("../src").Token<typeof numberKey, number>], never, readonly [import("../src").Token<typeof promiseKey, Promise<42>>]> & {
    readonly all: readonly [import("../src").Token<typeof numberKey, number>];
}, {
    number: number;
    promise: Promise<42> | undefined;
    lazyNumber: () => number;
    numbers: readonly number[];
}>;
export declare const overloadedProvider: Provider<() => {
    kind: 'last';
}, Readonly<{}>, readonly [], TokenGraph<readonly [], never, readonly []>, {
    kind: 'last';
}>;
export declare const genericProvider: Provider<() => unknown, Readonly<{}>, readonly [], TokenGraph<readonly [], never, readonly []>, unknown>;
export declare const extract: typeof fromTokens;
export declare const extracted: Provider<() => {
    value: number;
}, Readonly<{}>, readonly [], TokenGraph<readonly [import("../src").Token<typeof numberKey, number>], never, readonly []>, {
    value: number;
}>;
export declare const specialized: {
    (tokens: readonly [import("../src").Token<typeof numberKey, number>], callback: (value: number) => 'special', options?: {
        readonly acquisition: "auto";
    } | undefined): Provider<() => "special", Readonly<{}>, readonly [], TokenGraph<readonly [import("../src").Token<typeof numberKey, number>], never, readonly []>, "special">;
    (tokens: readonly [import("../src").Token<typeof numberKey, number>], callback: (value: number) => 'special', options?: {
        readonly acquisition: "auto";
    } | undefined): Provider<() => "special", Readonly<{}>, readonly [], TokenGraph<readonly [import("../src").Token<typeof numberKey, number>]>, "special">;
};
export declare const specializedResult: Provider<() => "special", Readonly<{}>, readonly [], TokenGraph<readonly [import("../src").Token<typeof numberKey, number>], never, readonly []>, "special">;
export declare const metadata: Provider<() => {
    number: number;
    promise: Promise<42>;
}, Readonly<Readonly<{}> & {
    tag: 'test';
}>, readonly [], TokenGraph<readonly [import("../src").Token<typeof numberKey, number>, import("../src").Token<typeof promiseKey, Promise<42>>], never, readonly []>, {
    number: number;
    promise: Promise<42>;
}>;
export declare const acquisition: Provider<() => Promise<42>, Readonly<{}>, readonly [Readonly<{
    value: Promise<42>;
}>], TokenGraph<readonly [], never, readonly []>, Promise<42>>;
export declare const feature: import("../src").Module<Pick<import("../src").Provided<import("../src").From<{
    key: typeof numberKey;
    registration: import("../src").Binding<import("../src").Token<typeof numberKey, number>, () => number>;
} | {
    key: typeof promiseKey;
    registration: import("../src").Binding<import("../src").Token<typeof promiseKey, Promise<42>>, () => Promise<42>>;
} | {
    key: typeof outputKey;
    registration: import("../src").Binding<import("../src").Token<typeof outputKey, {
        value: number;
    }>, Provider<() => {
        value: number;
    }, Readonly<{}>, readonly [], TokenGraph<readonly [import("../src").Token<typeof numberKey, number>], never, readonly []>, {
        value: number;
    }>>;
} | import("../src").Entries<{
    plain: Provider<() => 42, Readonly<{}>, readonly [], TokenGraph<readonly [], never, readonly []>, 42>;
    raw: Provider<() => Promise<42>, Readonly<{}>, readonly [], TokenGraph<readonly [], never, readonly []>, Promise<42>>;
    metadata: Provider<() => {
        number: number;
        promise: Promise<42>;
    }, Readonly<Readonly<{}> & {
        tag: 'test';
    }>, readonly [], TokenGraph<readonly [import("../src").Token<typeof numberKey, number>, import("../src").Token<typeof promiseKey, Promise<42>>], never, readonly []>, {
        number: number;
        promise: Promise<42>;
    }>;
    acquisition: Provider<() => Promise<42>, Readonly<{}>, readonly [Readonly<{
        value: Promise<42>;
    }>], TokenGraph<readonly [], never, readonly []>, Promise<42>>;
}>>>, "acquisition" | "metadata" | "plain" | "raw" | typeof outputKey>, Readonly<{}>, never, ModulePublicProviders<import("../src").From<{
    key: typeof numberKey;
    registration: import("../src").Binding<import("../src").Token<typeof numberKey, number>, () => number>;
} | {
    key: typeof promiseKey;
    registration: import("../src").Binding<import("../src").Token<typeof promiseKey, Promise<42>>, () => Promise<42>>;
} | {
    key: typeof outputKey;
    registration: import("../src").Binding<import("../src").Token<typeof outputKey, {
        value: number;
    }>, Provider<() => {
        value: number;
    }, Readonly<{}>, readonly [], TokenGraph<readonly [import("../src").Token<typeof numberKey, number>], never, readonly []>, {
        value: number;
    }>>;
} | import("../src").Entries<{
    plain: Provider<() => 42, Readonly<{}>, readonly [], TokenGraph<readonly [], never, readonly []>, 42>;
    raw: Provider<() => Promise<42>, Readonly<{}>, readonly [], TokenGraph<readonly [], never, readonly []>, Promise<42>>;
    metadata: Provider<() => {
        number: number;
        promise: Promise<42>;
    }, Readonly<Readonly<{}> & {
        tag: 'test';
    }>, readonly [], TokenGraph<readonly [import("../src").Token<typeof numberKey, number>, import("../src").Token<typeof promiseKey, Promise<42>>], never, readonly []>, {
        number: number;
        promise: Promise<42>;
    }>;
    acquisition: Provider<() => Promise<42>, Readonly<{}>, readonly [Readonly<{
        value: Promise<42>;
    }>], TokenGraph<readonly [], never, readonly []>, Promise<42>>;
}>>, "acquisition" | "metadata" | "plain" | "raw" | typeof outputKey>>;
export declare const installed: import("../src").Bag<import("../src").From<import("../src").Entries<ModulePublicProviders<import("../src").From<{
    key: typeof numberKey;
    registration: import("../src").Binding<import("../src").Token<typeof numberKey, number>, () => number>;
} | {
    key: typeof promiseKey;
    registration: import("../src").Binding<import("../src").Token<typeof promiseKey, Promise<42>>, () => Promise<42>>;
} | {
    key: typeof outputKey;
    registration: import("../src").Binding<import("../src").Token<typeof outputKey, {
        value: number;
    }>, Provider<() => {
        value: number;
    }, Readonly<{}>, readonly [], TokenGraph<readonly [import("../src").Token<typeof numberKey, number>], never, readonly []>, {
        value: number;
    }>>;
} | import("../src").Entries<{
    plain: Provider<() => 42, Readonly<{}>, readonly [], TokenGraph<readonly [], never, readonly []>, 42>;
    raw: Provider<() => Promise<42>, Readonly<{}>, readonly [], TokenGraph<readonly [], never, readonly []>, Promise<42>>;
    metadata: Provider<() => {
        number: number;
        promise: Promise<42>;
    }, Readonly<Readonly<{}> & {
        tag: 'test';
    }>, readonly [], TokenGraph<readonly [import("../src").Token<typeof numberKey, number>, import("../src").Token<typeof promiseKey, Promise<42>>], never, readonly []>, {
        number: number;
        promise: Promise<42>;
    }>;
    acquisition: Provider<() => Promise<42>, Readonly<{}>, readonly [Readonly<{
        value: Promise<42>;
    }>], TokenGraph<readonly [], never, readonly []>, Promise<42>>;
}>>, "acquisition" | "metadata" | "plain" | "raw" | typeof outputKey>>>, never>;
export declare const installedOutput: {
    value: number;
};
export declare const installedPlain: 42;
export declare const installedRaw: Promise<42>;
export declare const installedMetadata: {
    number: number;
    promise: Promise<42>;
};
export declare const installedAcquisition: Promise<42>;
export type EqualityChecks = [
    Assert<Equal<typeof literal, Old<() => 42>>>,
    Assert<Equal<ProviderFactory<typeof literal>, () => 42>>,
    Assert<Equal<ProviderOutput<typeof raw>, Promise<42>>>,
    Assert<Equal<ProviderAcquired<typeof raw>, Promise<42>>>,
    Assert<Equal<ProviderAcquired<typeof native>, 42>>,
    Assert<Equal<ProviderAcquired<typeof promised>, 42>>,
    Assert<Equal<ProviderOutput<typeof functional>, (value: number) => string>>,
    Assert<Equal<ProviderOutput<typeof anyOutput>, any>>,
    Assert<Equal<ProviderOutput<typeof neverOutput>, never>>,
    Assert<Equal<ProviderOutput<typeof unknownOutput>, unknown>>,
    Assert<Equal<ProviderOutput<typeof overloadedProvider>, {
        kind: 'last';
    }>>,
    Assert<Equal<ProviderOutput<typeof genericProvider>, unknown>>,
    Assert<Equal<ProviderOutput<typeof references>, {
        number: number;
        promise: Promise<42> | undefined;
        lazyNumber: () => number;
        numbers: readonly number[];
    }>>,
    Assert<Equal<ReturnType<typeof specialized>, Old<(value: number) => 'special', readonly [typeof numberToken]>>>,
    Assert<Equal<ProviderOutput<typeof specializedResult>, 'special'>>,
    Assert<Equal<PublicProvider<typeof literal>, () => 42>>,
    Assert<Equal<PublicProvider<typeof raw>, LegacyPublicProvider<typeof raw>>>,
    Assert<Equal<PublicProvider<typeof metadata>, LegacyPublicProvider<typeof metadata>>>,
    Assert<Equal<PublicProvider<typeof acquisition>, LegacyPublicProvider<typeof acquisition>>>,
    Assert<Equal<PublicProvider<any>, LegacyPublicProvider<any>>>,
    Assert<Equal<PublicProvider<never>, LegacyPublicProvider<never>>>,
    Assert<Equal<PublicProvider<typeof anyOutput>, LegacyPublicProvider<typeof anyOutput>>>,
    Assert<Equal<PublicProvider<typeof neverOutput>, LegacyPublicProvider<typeof neverOutput>>>,
    Assert<Equal<PublicProvider<typeof literal | typeof raw>, LegacyPublicProvider<typeof literal | typeof raw>>>,
    Assert<Equal<PublicProvider<NoInfer<typeof literal>>, LegacyPublicProvider<NoInfer<typeof literal>>>>,
    Assert<Equal<ProviderNeeds<PublicProvider<typeof metadata>>, Record<never, never>>>,
    Assert<Equal<ProviderMetadata<PublicProvider<typeof metadata>>, ProviderMetadata<typeof metadata> & object>>,
    Assert<Equal<ProviderAcquired<PublicProvider<typeof raw>>, Promise<42>>>,
    Assert<Equal<typeof installedOutput, {
        value: number;
    }>>,
    Assert<Equal<typeof installedPlain, 42>>,
    Assert<Equal<typeof installedRaw, Promise<42>>>,
    Assert<Equal<typeof installedMetadata, {
        number: number;
        promise: Promise<42>;
    }>>,
    Assert<Equal<typeof installedAcquisition, Promise<42>>>,
    Assert<Equal<typeof inferredLiteral, 1>>,
    Assert<Equal<typeof inferredObject, {
        kind: 'value';
    }>>,
    Assert<Equal<typeof inferredPromise, Promise<42>>>,
    Assert<Equal<typeof inferredFunction, {
        kind: 'callback';
    }>>,
    Assert<Equal<typeof inferredFromProvider, {
        kind: 'provider';
    }>>,
    Assert<Equal<typeof inferredFromPublic, {
        kind: 'public';
    }>>,
    Assert<Equal<typeof inferredFromPublicOutput, unknown>>
];
export declare function deferredReflectedTokens<T extends readonly TokenBase[], F extends (this: void, ...args: TokenArguments<NoInfer<T>>) => unknown>(value: ReturnType<typeof fromTokens<T, F>>): Old<F, T>;
export declare function deferredReflectedTokensBack<T extends readonly TokenBase[], F extends (this: void, ...args: TokenArguments<NoInfer<T>>) => unknown>(value: Old<F, T>): ReturnType<typeof fromTokens<T, F>>;
export {};
