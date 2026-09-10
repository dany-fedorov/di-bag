export declare const graph: import("../src").Bag<import("../src").From<import("../src").Entries<{
    db: import("../src").Provider<() => {
        query: () => number;
    }, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
        readonly lifetime: {
            readonly kind: "root";
            readonly captureScoped: false;
        };
    }, {
        query: () => number;
    }>;
    repo: import("../src").Provider<({ db }: {
        db: {
            query(): number;
        };
    }) => number, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
        readonly lifetime: {
            readonly kind: "root";
            readonly captureScoped: false;
        };
    }, number>;
}>>, never>;
export declare const reflectedScope: {
    <const S extends readonly unknown[]>(options: import("../src").ScopeOptions<import("../src").From<import("../src").Entries<{
        db: import("../src").Provider<() => {
            query: () => number;
        }, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, {
            query: () => number;
        }>;
        repo: import("../src").Provider<({ db }: {
            db: {
                query(): number;
            };
        }) => number, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, number>;
    }>>, S>): import("../src").Bag<import("../src").SharedAliasProviders<import("../src").From<import("../src").Entries<{
        db: import("../src").Provider<() => {
            query: () => number;
        }, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, {
            query: () => number;
        }>;
        repo: import("../src").Provider<({ db }: {
            db: {
                query(): number;
            };
        }) => number, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, number>;
    }>>, import("../src").From<import("../src").Entries<{
        db: import("../src").Provider<() => {
            query: () => number;
        }, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, {
            query: () => number;
        }>;
        repo: import("../src").Provider<({ db }: {
            db: {
                query(): number;
            };
        }) => number, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, number>;
    }>>, S>, never>;
    <const K extends readonly unknown[], O extends import("../src").ForkContext<import("../src").From<import("../src").Entries<{
        db: import("../src").Provider<() => {
            query: () => number;
        }, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, {
            query: () => number;
        }>;
        repo: import("../src").Provider<({ db }: {
            db: {
                query(): number;
            };
        }) => number, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, number>;
    }>>, K, O>, const S extends readonly unknown[] = readonly []>(keys: K & import("../src").Selection<import("../src").From<import("../src").Entries<{
        db: import("../src").Provider<() => {
            query: () => number;
        }, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, {
            query: () => number;
        }>;
        repo: import("../src").Provider<({ db }: {
            db: {
                query(): number;
            };
        }) => number, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, number>;
    }>>, K, "scope">, overrides: O & object & Record<import("../src").SelectionKey<K[number]>, import("../src").Registration> & import("../src").Overrides<import("../src").From<import("../src").Entries<{
        db: import("../src").Provider<() => {
            query: () => number;
        }, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, {
            query: () => number;
        }>;
        repo: import("../src").Provider<({ db }: {
            db: {
                query(): number;
            };
        }) => number, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, number>;
    }>>, import("../src").Selected<K, O>> & import("../src").Checked<import("../src").Merge<import("../src").From<import("../src").Entries<{
        db: import("../src").Provider<() => {
            query: () => number;
        }, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, {
            query: () => number;
        }>;
        repo: import("../src").Provider<({ db }: {
            db: {
                query(): number;
            };
        }) => number, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, number>;
    }>>, import("../src").ReboundSelection<import("../src").From<import("../src").Entries<{
        db: import("../src").Provider<() => {
            query: () => number;
        }, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, {
            query: () => number;
        }>;
        repo: import("../src").Provider<({ db }: {
            db: {
                query(): number;
            };
        }) => number, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, number>;
    }>>, import("../src").Selected<K, O>>>> & import("../src").Complete<import("../src").Merge<import("../src").From<import("../src").Entries<{
        db: import("../src").Provider<() => {
            query: () => number;
        }, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, {
            query: () => number;
        }>;
        repo: import("../src").Provider<({ db }: {
            db: {
                query(): number;
            };
        }) => number, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, number>;
    }>>, import("../src").ReboundSelection<import("../src").From<import("../src").Entries<{
        db: import("../src").Provider<() => {
            query: () => number;
        }, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, {
            query: () => number;
        }>;
        repo: import("../src").Provider<({ db }: {
            db: {
                query(): number;
            };
        }) => number, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, number>;
    }>>, import("../src").Selected<K, O>>>> & import("../src").CheckedScopeLifetimes<NoInfer<import("../src").SharedAliasProviders<import("../src").UnsharedAliases<import("../src").Merge<import("../src").From<import("../src").Entries<{
        db: import("../src").Provider<() => {
            query: () => number;
        }, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, {
            query: () => number;
        }>;
        repo: import("../src").Provider<({ db }: {
            db: {
                query(): number;
            };
        }) => number, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, number>;
    }>>, import("../src").ReboundSelection<import("../src").From<import("../src").Entries<{
        db: import("../src").Provider<() => {
            query: () => number;
        }, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, {
            query: () => number;
        }>;
        repo: import("../src").Provider<({ db }: {
            db: {
                query(): number;
            };
        }) => number, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, number>;
    }>>, import("../src").Selected<K, O>>>>, import("../src").From<import("../src").Entries<{
        db: import("../src").Provider<() => {
            query: () => number;
        }, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, {
            query: () => number;
        }>;
        repo: import("../src").Provider<({ db }: {
            db: {
                query(): number;
            };
        }) => number, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, number>;
    }>>, S>>, NoInfer<import("../src").Selected<K, O>>, never>, options?: (import("../src").ScopeOptions<import("../src").From<import("../src").Entries<{
        db: import("../src").Provider<() => {
            query: () => number;
        }, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, {
            query: () => number;
        }>;
        repo: import("../src").Provider<({ db }: {
            db: {
                query(): number;
            };
        }) => number, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, number>;
    }>>, S> & import("../src").DisjointScopeSelection<K, S>) | undefined): import("../src").Bag<import("../src").SharedAliasProviders<import("../src").UnsharedAliases<import("../src").Merge<import("../src").From<import("../src").Entries<{
        db: import("../src").Provider<() => {
            query: () => number;
        }, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, {
            query: () => number;
        }>;
        repo: import("../src").Provider<({ db }: {
            db: {
                query(): number;
            };
        }) => number, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, number>;
    }>>, import("../src").ReboundSelection<import("../src").From<import("../src").Entries<{
        db: import("../src").Provider<() => {
            query: () => number;
        }, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, {
            query: () => number;
        }>;
        repo: import("../src").Provider<({ db }: {
            db: {
                query(): number;
            };
        }) => number, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, number>;
    }>>, import("../src").Selected<K, O>>>>, import("../src").From<import("../src").Entries<{
        db: import("../src").Provider<() => {
            query: () => number;
        }, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, {
            query: () => number;
        }>;
        repo: import("../src").Provider<({ db }: {
            db: {
                query(): number;
            };
        }) => number, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, number>;
    }>>, S>, never>;
    (): import("../src").Bag<import("../src").From<import("../src").Entries<{
        db: import("../src").Provider<() => {
            query: () => number;
        }, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, {
            query: () => number;
        }>;
        repo: import("../src").Provider<({ db }: {
            db: {
                query(): number;
            };
        }) => number, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, number>;
    }>>, never>;
};
export declare const reflectedFork: {
    (this: import("../src").Bag<import("../src").From<import("../src").Entries<{
        db: import("../src").Provider<() => {
            query: () => number;
        }, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, {
            query: () => number;
        }>;
        repo: import("../src").Provider<({ db }: {
            db: {
                query(): number;
            };
        }) => number, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, number>;
    }>>, never>): import("../src").Bag<import("../src").From<import("../src").Entries<{
        db: import("../src").Provider<() => {
            query: () => number;
        }, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, {
            query: () => number;
        }>;
        repo: import("../src").Provider<({ db }: {
            db: {
                query(): number;
            };
        }) => number, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, number>;
    }>>, never>;
    <const K extends readonly unknown[], O extends import("../src").ForkContext<import("../src").From<import("../src").Entries<{
        db: import("../src").Provider<() => {
            query: () => number;
        }, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, {
            query: () => number;
        }>;
        repo: import("../src").Provider<({ db }: {
            db: {
                query(): number;
            };
        }) => number, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, number>;
    }>>, K, O>>(keys: K & import("../src").Selection<import("../src").From<import("../src").Entries<{
        db: import("../src").Provider<() => {
            query: () => number;
        }, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, {
            query: () => number;
        }>;
        repo: import("../src").Provider<({ db }: {
            db: {
                query(): number;
            };
        }) => number, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, number>;
    }>>, K, "fork">, overrides: O & object & Record<import("../src").SelectionKey<K[number]>, import("../src").Registration> & import("../src").Overrides<import("../src").From<import("../src").Entries<{
        db: import("../src").Provider<() => {
            query: () => number;
        }, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, {
            query: () => number;
        }>;
        repo: import("../src").Provider<({ db }: {
            db: {
                query(): number;
            };
        }) => number, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, number>;
    }>>, import("../src").Selected<K, O>> & import("../src").Checked<import("../src").Merge<import("../src").From<import("../src").Entries<{
        db: import("../src").Provider<() => {
            query: () => number;
        }, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, {
            query: () => number;
        }>;
        repo: import("../src").Provider<({ db }: {
            db: {
                query(): number;
            };
        }) => number, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, number>;
    }>>, import("../src").ReboundSelection<import("../src").From<import("../src").Entries<{
        db: import("../src").Provider<() => {
            query: () => number;
        }, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, {
            query: () => number;
        }>;
        repo: import("../src").Provider<({ db }: {
            db: {
                query(): number;
            };
        }) => number, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, number>;
    }>>, import("../src").Selected<K, O>>>> & import("../src").Complete<import("../src").Merge<import("../src").From<import("../src").Entries<{
        db: import("../src").Provider<() => {
            query: () => number;
        }, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, {
            query: () => number;
        }>;
        repo: import("../src").Provider<({ db }: {
            db: {
                query(): number;
            };
        }) => number, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, number>;
    }>>, import("../src").ReboundSelection<import("../src").From<import("../src").Entries<{
        db: import("../src").Provider<() => {
            query: () => number;
        }, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, {
            query: () => number;
        }>;
        repo: import("../src").Provider<({ db }: {
            db: {
                query(): number;
            };
        }) => number, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, number>;
    }>>, import("../src").Selected<K, O>>>> & import("../src").CheckedLifetimes<import("../src").UnsharedAliases<import("../src").Merge<import("../src").From<import("../src").Entries<{
        db: import("../src").Provider<() => {
            query: () => number;
        }, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, {
            query: () => number;
        }>;
        repo: import("../src").Provider<({ db }: {
            db: {
                query(): number;
            };
        }) => number, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, number>;
    }>>, import("../src").ReboundSelection<import("../src").From<import("../src").Entries<{
        db: import("../src").Provider<() => {
            query: () => number;
        }, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, {
            query: () => number;
        }>;
        repo: import("../src").Provider<({ db }: {
            db: {
                query(): number;
            };
        }) => number, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, number>;
    }>>, import("../src").Selected<K, O>>>>, never>): import("../src").Bag<import("../src").UnsharedAliases<import("../src").Merge<import("../src").From<import("../src").Entries<{
        db: import("../src").Provider<() => {
            query: () => number;
        }, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, {
            query: () => number;
        }>;
        repo: import("../src").Provider<({ db }: {
            db: {
                query(): number;
            };
        }) => number, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, number>;
    }>>, import("../src").ReboundSelection<import("../src").From<import("../src").Entries<{
        db: import("../src").Provider<() => {
            query: () => number;
        }, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, {
            query: () => number;
        }>;
        repo: import("../src").Provider<({ db }: {
            db: {
                query(): number;
            };
        }) => number, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, number>;
    }>>, import("../src").Selected<K, O>>>>, never>;
};
export declare const reflectedEnd: (this: import("../src").Builder<{
    key: "value";
    registration: () => number;
}, never>) => import("../src").Bag<import("../src").From<{
    key: "value";
    registration: () => number;
}>, never>;
export declare const reflectedStart: <const K extends readonly unknown[]>(this: import("../src").Builder<{
    key: "value";
    registration: () => number;
}, never>, keys: K & import("../src").Selection<import("../src").From<{
    key: "value";
    registration: () => number;
}>, K, "start">, options?: import("../src").StartupOptions) => Promise<import("../src").Bag<import("../src").From<{
    key: "value";
    registration: () => number;
}>, never>>;
export declare function reflectedScopeWrapper(): {
    <const S extends readonly unknown[]>(options: import("../src").ScopeOptions<import("../src").From<import("../src").Entries<{
        db: import("../src").Provider<() => {
            query: () => number;
        }, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, {
            query: () => number;
        }>;
        repo: import("../src").Provider<({ db }: {
            db: {
                query(): number;
            };
        }) => number, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, number>;
    }>>, S>): import("../src").Bag<import("../src").SharedAliasProviders<import("../src").From<import("../src").Entries<{
        db: import("../src").Provider<() => {
            query: () => number;
        }, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, {
            query: () => number;
        }>;
        repo: import("../src").Provider<({ db }: {
            db: {
                query(): number;
            };
        }) => number, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, number>;
    }>>, import("../src").From<import("../src").Entries<{
        db: import("../src").Provider<() => {
            query: () => number;
        }, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, {
            query: () => number;
        }>;
        repo: import("../src").Provider<({ db }: {
            db: {
                query(): number;
            };
        }) => number, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, number>;
    }>>, S>, never>;
    <const K extends readonly unknown[], O extends import("../src").ForkContext<import("../src").From<import("../src").Entries<{
        db: import("../src").Provider<() => {
            query: () => number;
        }, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, {
            query: () => number;
        }>;
        repo: import("../src").Provider<({ db }: {
            db: {
                query(): number;
            };
        }) => number, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, number>;
    }>>, K, O>, const S extends readonly unknown[] = readonly []>(keys: K & import("../src").Selection<import("../src").From<import("../src").Entries<{
        db: import("../src").Provider<() => {
            query: () => number;
        }, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, {
            query: () => number;
        }>;
        repo: import("../src").Provider<({ db }: {
            db: {
                query(): number;
            };
        }) => number, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, number>;
    }>>, K, "scope">, overrides: O & object & Record<import("../src").SelectionKey<K[number]>, import("../src").Registration> & import("../src").Overrides<import("../src").From<import("../src").Entries<{
        db: import("../src").Provider<() => {
            query: () => number;
        }, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, {
            query: () => number;
        }>;
        repo: import("../src").Provider<({ db }: {
            db: {
                query(): number;
            };
        }) => number, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, number>;
    }>>, import("../src").Selected<K, O>> & import("../src").Checked<import("../src").Merge<import("../src").From<import("../src").Entries<{
        db: import("../src").Provider<() => {
            query: () => number;
        }, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, {
            query: () => number;
        }>;
        repo: import("../src").Provider<({ db }: {
            db: {
                query(): number;
            };
        }) => number, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, number>;
    }>>, import("../src").ReboundSelection<import("../src").From<import("../src").Entries<{
        db: import("../src").Provider<() => {
            query: () => number;
        }, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, {
            query: () => number;
        }>;
        repo: import("../src").Provider<({ db }: {
            db: {
                query(): number;
            };
        }) => number, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, number>;
    }>>, import("../src").Selected<K, O>>>> & import("../src").Complete<import("../src").Merge<import("../src").From<import("../src").Entries<{
        db: import("../src").Provider<() => {
            query: () => number;
        }, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, {
            query: () => number;
        }>;
        repo: import("../src").Provider<({ db }: {
            db: {
                query(): number;
            };
        }) => number, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, number>;
    }>>, import("../src").ReboundSelection<import("../src").From<import("../src").Entries<{
        db: import("../src").Provider<() => {
            query: () => number;
        }, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, {
            query: () => number;
        }>;
        repo: import("../src").Provider<({ db }: {
            db: {
                query(): number;
            };
        }) => number, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, number>;
    }>>, import("../src").Selected<K, O>>>> & import("../src").CheckedScopeLifetimes<NoInfer<import("../src").SharedAliasProviders<import("../src").UnsharedAliases<import("../src").Merge<import("../src").From<import("../src").Entries<{
        db: import("../src").Provider<() => {
            query: () => number;
        }, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, {
            query: () => number;
        }>;
        repo: import("../src").Provider<({ db }: {
            db: {
                query(): number;
            };
        }) => number, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, number>;
    }>>, import("../src").ReboundSelection<import("../src").From<import("../src").Entries<{
        db: import("../src").Provider<() => {
            query: () => number;
        }, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, {
            query: () => number;
        }>;
        repo: import("../src").Provider<({ db }: {
            db: {
                query(): number;
            };
        }) => number, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, number>;
    }>>, import("../src").Selected<K, O>>>>, import("../src").From<import("../src").Entries<{
        db: import("../src").Provider<() => {
            query: () => number;
        }, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, {
            query: () => number;
        }>;
        repo: import("../src").Provider<({ db }: {
            db: {
                query(): number;
            };
        }) => number, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, number>;
    }>>, S>>, NoInfer<import("../src").Selected<K, O>>, never>, options?: (import("../src").ScopeOptions<import("../src").From<import("../src").Entries<{
        db: import("../src").Provider<() => {
            query: () => number;
        }, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, {
            query: () => number;
        }>;
        repo: import("../src").Provider<({ db }: {
            db: {
                query(): number;
            };
        }) => number, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, number>;
    }>>, S> & import("../src").DisjointScopeSelection<K, S>) | undefined): import("../src").Bag<import("../src").SharedAliasProviders<import("../src").UnsharedAliases<import("../src").Merge<import("../src").From<import("../src").Entries<{
        db: import("../src").Provider<() => {
            query: () => number;
        }, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, {
            query: () => number;
        }>;
        repo: import("../src").Provider<({ db }: {
            db: {
                query(): number;
            };
        }) => number, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, number>;
    }>>, import("../src").ReboundSelection<import("../src").From<import("../src").Entries<{
        db: import("../src").Provider<() => {
            query: () => number;
        }, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, {
            query: () => number;
        }>;
        repo: import("../src").Provider<({ db }: {
            db: {
                query(): number;
            };
        }) => number, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, number>;
    }>>, import("../src").Selected<K, O>>>>, import("../src").From<import("../src").Entries<{
        db: import("../src").Provider<() => {
            query: () => number;
        }, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, {
            query: () => number;
        }>;
        repo: import("../src").Provider<({ db }: {
            db: {
                query(): number;
            };
        }) => number, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, number>;
    }>>, S>, never>;
    (): import("../src").Bag<import("../src").From<import("../src").Entries<{
        db: import("../src").Provider<() => {
            query: () => number;
        }, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, {
            query: () => number;
        }>;
        repo: import("../src").Provider<({ db }: {
            db: {
                query(): number;
            };
        }) => number, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, number>;
    }>>, never>;
};
export declare function reflectedForkWrapper(): {
    (this: import("../src").Bag<import("../src").From<import("../src").Entries<{
        db: import("../src").Provider<() => {
            query: () => number;
        }, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, {
            query: () => number;
        }>;
        repo: import("../src").Provider<({ db }: {
            db: {
                query(): number;
            };
        }) => number, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, number>;
    }>>, never>): import("../src").Bag<import("../src").From<import("../src").Entries<{
        db: import("../src").Provider<() => {
            query: () => number;
        }, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, {
            query: () => number;
        }>;
        repo: import("../src").Provider<({ db }: {
            db: {
                query(): number;
            };
        }) => number, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, number>;
    }>>, never>;
    <const K extends readonly unknown[], O extends import("../src").ForkContext<import("../src").From<import("../src").Entries<{
        db: import("../src").Provider<() => {
            query: () => number;
        }, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, {
            query: () => number;
        }>;
        repo: import("../src").Provider<({ db }: {
            db: {
                query(): number;
            };
        }) => number, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, number>;
    }>>, K, O>>(keys: K & import("../src").Selection<import("../src").From<import("../src").Entries<{
        db: import("../src").Provider<() => {
            query: () => number;
        }, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, {
            query: () => number;
        }>;
        repo: import("../src").Provider<({ db }: {
            db: {
                query(): number;
            };
        }) => number, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, number>;
    }>>, K, "fork">, overrides: O & object & Record<import("../src").SelectionKey<K[number]>, import("../src").Registration> & import("../src").Overrides<import("../src").From<import("../src").Entries<{
        db: import("../src").Provider<() => {
            query: () => number;
        }, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, {
            query: () => number;
        }>;
        repo: import("../src").Provider<({ db }: {
            db: {
                query(): number;
            };
        }) => number, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, number>;
    }>>, import("../src").Selected<K, O>> & import("../src").Checked<import("../src").Merge<import("../src").From<import("../src").Entries<{
        db: import("../src").Provider<() => {
            query: () => number;
        }, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, {
            query: () => number;
        }>;
        repo: import("../src").Provider<({ db }: {
            db: {
                query(): number;
            };
        }) => number, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, number>;
    }>>, import("../src").ReboundSelection<import("../src").From<import("../src").Entries<{
        db: import("../src").Provider<() => {
            query: () => number;
        }, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, {
            query: () => number;
        }>;
        repo: import("../src").Provider<({ db }: {
            db: {
                query(): number;
            };
        }) => number, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, number>;
    }>>, import("../src").Selected<K, O>>>> & import("../src").Complete<import("../src").Merge<import("../src").From<import("../src").Entries<{
        db: import("../src").Provider<() => {
            query: () => number;
        }, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, {
            query: () => number;
        }>;
        repo: import("../src").Provider<({ db }: {
            db: {
                query(): number;
            };
        }) => number, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, number>;
    }>>, import("../src").ReboundSelection<import("../src").From<import("../src").Entries<{
        db: import("../src").Provider<() => {
            query: () => number;
        }, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, {
            query: () => number;
        }>;
        repo: import("../src").Provider<({ db }: {
            db: {
                query(): number;
            };
        }) => number, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, number>;
    }>>, import("../src").Selected<K, O>>>> & import("../src").CheckedLifetimes<import("../src").UnsharedAliases<import("../src").Merge<import("../src").From<import("../src").Entries<{
        db: import("../src").Provider<() => {
            query: () => number;
        }, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, {
            query: () => number;
        }>;
        repo: import("../src").Provider<({ db }: {
            db: {
                query(): number;
            };
        }) => number, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, number>;
    }>>, import("../src").ReboundSelection<import("../src").From<import("../src").Entries<{
        db: import("../src").Provider<() => {
            query: () => number;
        }, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, {
            query: () => number;
        }>;
        repo: import("../src").Provider<({ db }: {
            db: {
                query(): number;
            };
        }) => number, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, number>;
    }>>, import("../src").Selected<K, O>>>>, never>): import("../src").Bag<import("../src").UnsharedAliases<import("../src").Merge<import("../src").From<import("../src").Entries<{
        db: import("../src").Provider<() => {
            query: () => number;
        }, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, {
            query: () => number;
        }>;
        repo: import("../src").Provider<({ db }: {
            db: {
                query(): number;
            };
        }) => number, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, number>;
    }>>, import("../src").ReboundSelection<import("../src").From<import("../src").Entries<{
        db: import("../src").Provider<() => {
            query: () => number;
        }, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, {
            query: () => number;
        }>;
        repo: import("../src").Provider<({ db }: {
            db: {
                query(): number;
            };
        }) => number, Readonly<{}>, readonly [], Omit<import("../src").TokenGraph, "lifetime"> & {
            readonly lifetime: {
                readonly kind: "root";
                readonly captureScoped: false;
            };
        }, number>;
    }>>, import("../src").Selected<K, O>>>>, never>;
};
