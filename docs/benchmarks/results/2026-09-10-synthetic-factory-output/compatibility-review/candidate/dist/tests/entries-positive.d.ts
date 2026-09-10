import type { Entries, From, Provided, Builder, ModuleBuilder, Registration, Provider } from '../src';
import type { Registrations } from '../src/registration';
type Legacy<R extends Registrations> = {
    [K in keyof R & (string | symbol)]: {
        key: K;
        registration: R[K];
    };
}[keyof R & (string | symbol)];
declare const s: unique symbol;
type R = {
    a: () => 1;
    b: () => string;
    readonly c: Provider<() => Promise<42>>;
    [s]: () => true;
};
export declare function toOld(value: Entries<R>): Legacy<R>;
export declare function toNew(value: Legacy<R>): Entries<R>;
export declare function fromToOld(value: From<Entries<R>>): From<Legacy<R>>;
export declare function fromToNew(value: From<Legacy<R>>): From<Entries<R>>;
export declare function oldBuilder(value: Builder<Entries<R>>): Builder<Legacy<R>>;
export declare function newBuilder(value: Builder<Legacy<R>>): Builder<Entries<R>>;
export declare function oldModule(value: ModuleBuilder<Entries<R>>): ModuleBuilder<Legacy<R>>;
export declare function newModule(value: ModuleBuilder<Legacy<R>>): ModuleBuilder<Entries<R>>;
export declare function noInferOld(value: Entries<NoInfer<R>>): Legacy<R>;
export declare function noInferNew(value: Legacy<NoInfer<R>>): Entries<R>;
export declare function deferred<K extends string | symbol, V extends Registration>(value: Entries<Record<K, V>>): Legacy<Record<K, V>>;
export declare function deferredBack<K extends string | symbol, V extends Registration>(value: Legacy<Record<K, V>>): Entries<Record<K, V>>;
export declare const inferred: R;
export declare const registrations: {
    a: () => number;
    b: ({ a }: {
        a: number;
    }) => string;
};
export declare const builder: Builder<Entries<{
    a: () => number;
    b: ({ a }: {
        a: number;
    }) => string;
}>, never>;
export declare const individual: Builder<{
    key: "a";
    registration: () => number;
} | {
    key: "b";
    registration: ({ a }: {
        a: number;
    }) => string;
}, never>;
export declare const same: typeof builder;
export declare const reverse: typeof individual;
export declare const moduleBuilder: ModuleBuilder<Entries<{
    a: () => number;
    b: ({ a }: {
        a: number;
    }) => string;
}>, never>;
export declare const moduleIndividual: ModuleBuilder<{
    key: "a";
    registration: () => number;
} | {
    key: "b";
    registration: ({ a }: {
        a: number;
    }) => string;
}, never>;
export declare const moduleSame: typeof moduleBuilder;
export declare const moduleReverse: typeof moduleIndividual;
export declare const moduleView: ReturnType<typeof moduleBuilder.replace>;
export declare const feature: import("../src").Module<Pick<Provided<From<{
    key: never;
    registration: import("../src").Binding<import("../src").TokenBase, Registration>;
} | Entries<{
    a: () => number;
    b: ({ a }: {
        a: number;
    }) => string;
}>>>, "a" | "b">, Readonly<{}>, {
    readonly consumer: "b";
    readonly needs: Pick<{
        a: number;
    }, "a">;
    readonly kind: "export";
}, import("../src").ModulePublicProviders<From<{
    key: never;
    registration: import("../src").Binding<import("../src").TokenBase, Registration>;
} | Entries<{
    a: () => number;
    b: ({ a }: {
        a: number;
    }) => string;
}>>, "a" | "b">>;
export declare const installed: Builder<Entries<import("../src").ModulePublicProviders<From<{
    key: never;
    registration: import("../src").Binding<import("../src").TokenBase, Registration>;
} | Entries<{
    a: () => number;
    b: ({ a }: {
        a: number;
    }) => string;
}>>, "a" | "b">>, {
    readonly consumer: "b";
    readonly needs: Pick<{
        a: number;
    }, "a">;
    readonly kind: "export";
}>;
export declare const finalized: import("../src").Bag<From<Entries<import("../src").ModulePublicProviders<From<{
    key: never;
    registration: import("../src").Binding<import("../src").TokenBase, Registration>;
} | Entries<{
    a: () => number;
    b: ({ a }: {
        a: number;
    }) => string;
}>>, "a" | "b">>>, {
    readonly consumer: "b";
    readonly needs: Pick<{
        a: number;
    }, "a">;
    readonly kind: "export";
}>;
export declare const result: string;
export declare const factory: () => Builder<{
    key: "b";
    registration: ({ a }: {
        a: number;
    }) => string;
} | {
    key: "a";
    registration: () => number;
}, never>;
export declare const moduleFactory: () => ModuleBuilder<{
    key: "b";
    registration: ({ a }: {
        a: number;
    }) => string;
} | {
    key: "a";
    registration: () => number;
}, never>;
export declare const valueKey: unique symbol;
export declare const token: import("../src").Token<typeof valueKey, {
    value: number;
}>;
export declare const tokenFeature: import("../src").Module<Pick<Provided<From<{
    key: typeof valueKey;
    registration: import("../src").Binding<import("../src").Token<typeof valueKey, {
        value: number;
    }>, () => {
        value: number;
    }>;
}>>, typeof valueKey>, Readonly<{}>, never, import("../src").ModulePublicProviders<From<{
    key: typeof valueKey;
    registration: import("../src").Binding<import("../src").Token<typeof valueKey, {
        value: number;
    }>, () => {
        value: number;
    }>;
}>, typeof valueKey>>;
export declare const tokenInstalled: Builder<{
    key: typeof valueKey;
    registration: Provider<() => {
        value: number;
    }, Readonly<{}> & object, readonly [], {
        readonly kind: 'tokens';
        readonly required: readonly [];
        readonly bound: import("../src").Token<typeof valueKey, {
            value: number;
        }>;
        readonly optional: readonly [];
    }, {
        value: number;
    }>;
}, never>;
export declare const tokenResult: {
    value: number;
};
export {};
