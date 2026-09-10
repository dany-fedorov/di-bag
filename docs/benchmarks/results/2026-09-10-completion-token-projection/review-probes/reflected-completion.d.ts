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
    }>>, import("../src").Selected<K, O>>>> & ([Exclude<((import("../src").Merge<import("../src").From<import("../src").Entries<{
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
    }>>, import("../src").Selected<K, O>>> extends infer T_1 extends import("../src/registration").Registrations ? { [K_2 in keyof T_1]: T_1[K_2]; } : never) extends infer T extends import("../src/registration").Registrations ? { [K_1 in keyof T]: keyof import("../src").ProviderNeeds<T[K_1]>; } : never)[keyof import("../src").ReboundSelection<import("../src").From<import("../src").Entries<{
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
    }>>, import("../src").Selected<K, O>> | Exclude<"db", keyof import("../src").ReboundSelection<import("../src").From<import("../src").Entries<{
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
    }>>, import("../src").Selected<K, O>>> | Exclude<"repo", keyof import("../src").ReboundSelection<import("../src").From<import("../src").Entries<{
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
    }>>, import("../src").Selected<K, O>>>], keyof import("../src").ReboundSelection<import("../src").From<import("../src").Entries<{
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
    }>>, import("../src").Selected<K, O>> | Exclude<"db", keyof import("../src").ReboundSelection<import("../src").From<import("../src").Entries<{
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
    }>>, import("../src").Selected<K, O>>> | Exclude<"repo", keyof import("../src").ReboundSelection<import("../src").From<import("../src").Entries<{
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
    }>>, import("../src").Selected<K, O>>>> | import("../src/token-types").MissingTokens<import("../src").Merge<import("../src").From<import("../src").Entries<{
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
    }>>, import("../src").Selected<K, O>>> extends infer T_2 extends import("../src/registration").Registrations ? { [K_2 in keyof T_2]: T_2[K_2]; } : never>] extends [never] ? [import("../src/token-types").InvalidGraphs<import("../src").Merge<import("../src").From<import("../src").Entries<{
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
    }>>, import("../src").Selected<K, O>>> extends infer T_3 extends import("../src/registration").Registrations ? { [K_2 in keyof T_3]: T_3[K_2]; } : never>] extends [never] ? unknown : import("../src/types").Unsatisfied<"token dependency has an incompatible or opaque contract", {
        tokens: import("../src/token-types").InvalidGraphs<import("../src").Merge<import("../src").From<import("../src").Entries<{
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
        }>>, import("../src").Selected<K, O>>> extends infer T_4 extends import("../src/registration").Registrations ? { [K_2 in keyof T_4]: T_4[K_2]; } : never>;
    }> : import("../src/types").Unsatisfied<"missing factories", {
        missing: Exclude<((import("../src").Merge<import("../src").From<import("../src").Entries<{
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
        }>>, import("../src").Selected<K, O>>> extends infer T_6 extends import("../src/registration").Registrations ? { [K_2 in keyof T_6]: T_6[K_2]; } : never) extends infer T_5 extends import("../src/registration").Registrations ? { [K_1 in keyof T_5]: keyof import("../src").ProviderNeeds<T_5[K_1]>; } : never)[keyof import("../src").ReboundSelection<import("../src").From<import("../src").Entries<{
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
        }>>, import("../src").Selected<K, O>> | Exclude<"db", keyof import("../src").ReboundSelection<import("../src").From<import("../src").Entries<{
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
        }>>, import("../src").Selected<K, O>>> | Exclude<"repo", keyof import("../src").ReboundSelection<import("../src").From<import("../src").Entries<{
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
        }>>, import("../src").Selected<K, O>>>], keyof import("../src").ReboundSelection<import("../src").From<import("../src").Entries<{
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
        }>>, import("../src").Selected<K, O>> | Exclude<"db", keyof import("../src").ReboundSelection<import("../src").From<import("../src").Entries<{
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
        }>>, import("../src").Selected<K, O>>> | Exclude<"repo", keyof import("../src").ReboundSelection<import("../src").From<import("../src").Entries<{
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
        }>>, import("../src").Selected<K, O>>>> | import("../src/token-types").MissingTokens<import("../src").Merge<import("../src").From<import("../src").Entries<{
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
        }>>, import("../src").Selected<K, O>>> extends infer T_7 extends import("../src/registration").Registrations ? { [K_2 in keyof T_7]: T_7[K_2]; } : never>;
    }>) & import("../src").CheckedScopeLifetimes<NoInfer<import("../src").SharedAliasProviders<import("../src").UnsharedAliases<import("../src").Merge<import("../src").From<import("../src").Entries<{
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
    }>>, import("../src").Selected<K, O>>>> & ([Exclude<((import("../src").Merge<import("../src").From<import("../src").Entries<{
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
    }>>, import("../src").Selected<K, O>>> extends infer T_1 extends import("../src/registration").Registrations ? { [K_2 in keyof T_1]: T_1[K_2]; } : never) extends infer T extends import("../src/registration").Registrations ? { [K_1 in keyof T]: keyof import("../src").ProviderNeeds<T[K_1]>; } : never)[keyof import("../src").ReboundSelection<import("../src").From<import("../src").Entries<{
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
    }>>, import("../src").Selected<K, O>> | Exclude<"db", keyof import("../src").ReboundSelection<import("../src").From<import("../src").Entries<{
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
    }>>, import("../src").Selected<K, O>>> | Exclude<"repo", keyof import("../src").ReboundSelection<import("../src").From<import("../src").Entries<{
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
    }>>, import("../src").Selected<K, O>>>], keyof import("../src").ReboundSelection<import("../src").From<import("../src").Entries<{
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
    }>>, import("../src").Selected<K, O>> | Exclude<"db", keyof import("../src").ReboundSelection<import("../src").From<import("../src").Entries<{
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
    }>>, import("../src").Selected<K, O>>> | Exclude<"repo", keyof import("../src").ReboundSelection<import("../src").From<import("../src").Entries<{
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
    }>>, import("../src").Selected<K, O>>>> | import("../src/token-types").MissingTokens<import("../src").Merge<import("../src").From<import("../src").Entries<{
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
    }>>, import("../src").Selected<K, O>>> extends infer T_2 extends import("../src/registration").Registrations ? { [K_2 in keyof T_2]: T_2[K_2]; } : never>] extends [never] ? [import("../src/token-types").InvalidGraphs<import("../src").Merge<import("../src").From<import("../src").Entries<{
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
    }>>, import("../src").Selected<K, O>>> extends infer T_3 extends import("../src/registration").Registrations ? { [K_2 in keyof T_3]: T_3[K_2]; } : never>] extends [never] ? unknown : import("../src/types").Unsatisfied<"token dependency has an incompatible or opaque contract", {
        tokens: import("../src/token-types").InvalidGraphs<import("../src").Merge<import("../src").From<import("../src").Entries<{
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
        }>>, import("../src").Selected<K, O>>> extends infer T_4 extends import("../src/registration").Registrations ? { [K_2 in keyof T_4]: T_4[K_2]; } : never>;
    }> : import("../src/types").Unsatisfied<"missing factories", {
        missing: Exclude<((import("../src").Merge<import("../src").From<import("../src").Entries<{
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
        }>>, import("../src").Selected<K, O>>> extends infer T_6 extends import("../src/registration").Registrations ? { [K_2 in keyof T_6]: T_6[K_2]; } : never) extends infer T_5 extends import("../src/registration").Registrations ? { [K_1 in keyof T_5]: keyof import("../src").ProviderNeeds<T_5[K_1]>; } : never)[keyof import("../src").ReboundSelection<import("../src").From<import("../src").Entries<{
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
        }>>, import("../src").Selected<K, O>> | Exclude<"db", keyof import("../src").ReboundSelection<import("../src").From<import("../src").Entries<{
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
        }>>, import("../src").Selected<K, O>>> | Exclude<"repo", keyof import("../src").ReboundSelection<import("../src").From<import("../src").Entries<{
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
        }>>, import("../src").Selected<K, O>>>], keyof import("../src").ReboundSelection<import("../src").From<import("../src").Entries<{
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
        }>>, import("../src").Selected<K, O>> | Exclude<"db", keyof import("../src").ReboundSelection<import("../src").From<import("../src").Entries<{
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
        }>>, import("../src").Selected<K, O>>> | Exclude<"repo", keyof import("../src").ReboundSelection<import("../src").From<import("../src").Entries<{
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
        }>>, import("../src").Selected<K, O>>>> | import("../src/token-types").MissingTokens<import("../src").Merge<import("../src").From<import("../src").Entries<{
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
        }>>, import("../src").Selected<K, O>>> extends infer T_7 extends import("../src/registration").Registrations ? { [K_2 in keyof T_7]: T_7[K_2]; } : never>;
    }>) & import("../src").CheckedLifetimes<import("../src").UnsharedAliases<import("../src").Merge<import("../src").From<import("../src").Entries<{
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
    }>>, import("../src").Selected<K, O>>>> & ([Exclude<((import("../src").Merge<import("../src").From<import("../src").Entries<{
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
    }>>, import("../src").Selected<K, O>>> extends infer T_1 extends import("../src/registration").Registrations ? { [K_2 in keyof T_1]: T_1[K_2]; } : never) extends infer T extends import("../src/registration").Registrations ? { [K_1 in keyof T]: keyof import("../src").ProviderNeeds<T[K_1]>; } : never)[keyof import("../src").ReboundSelection<import("../src").From<import("../src").Entries<{
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
    }>>, import("../src").Selected<K, O>> | Exclude<"db", keyof import("../src").ReboundSelection<import("../src").From<import("../src").Entries<{
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
    }>>, import("../src").Selected<K, O>>> | Exclude<"repo", keyof import("../src").ReboundSelection<import("../src").From<import("../src").Entries<{
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
    }>>, import("../src").Selected<K, O>>>], keyof import("../src").ReboundSelection<import("../src").From<import("../src").Entries<{
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
    }>>, import("../src").Selected<K, O>> | Exclude<"db", keyof import("../src").ReboundSelection<import("../src").From<import("../src").Entries<{
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
    }>>, import("../src").Selected<K, O>>> | Exclude<"repo", keyof import("../src").ReboundSelection<import("../src").From<import("../src").Entries<{
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
    }>>, import("../src").Selected<K, O>>>> | import("../src/token-types").MissingTokens<import("../src").Merge<import("../src").From<import("../src").Entries<{
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
    }>>, import("../src").Selected<K, O>>> extends infer T_2 extends import("../src/registration").Registrations ? { [K_2 in keyof T_2]: T_2[K_2]; } : never>] extends [never] ? [import("../src/token-types").InvalidGraphs<import("../src").Merge<import("../src").From<import("../src").Entries<{
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
    }>>, import("../src").Selected<K, O>>> extends infer T_3 extends import("../src/registration").Registrations ? { [K_2 in keyof T_3]: T_3[K_2]; } : never>] extends [never] ? unknown : import("../src/types").Unsatisfied<"token dependency has an incompatible or opaque contract", {
        tokens: import("../src/token-types").InvalidGraphs<import("../src").Merge<import("../src").From<import("../src").Entries<{
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
        }>>, import("../src").Selected<K, O>>> extends infer T_4 extends import("../src/registration").Registrations ? { [K_2 in keyof T_4]: T_4[K_2]; } : never>;
    }> : import("../src/types").Unsatisfied<"missing factories", {
        missing: Exclude<((import("../src").Merge<import("../src").From<import("../src").Entries<{
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
        }>>, import("../src").Selected<K, O>>> extends infer T_6 extends import("../src/registration").Registrations ? { [K_2 in keyof T_6]: T_6[K_2]; } : never) extends infer T_5 extends import("../src/registration").Registrations ? { [K_1 in keyof T_5]: keyof import("../src").ProviderNeeds<T_5[K_1]>; } : never)[keyof import("../src").ReboundSelection<import("../src").From<import("../src").Entries<{
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
        }>>, import("../src").Selected<K, O>> | Exclude<"db", keyof import("../src").ReboundSelection<import("../src").From<import("../src").Entries<{
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
        }>>, import("../src").Selected<K, O>>> | Exclude<"repo", keyof import("../src").ReboundSelection<import("../src").From<import("../src").Entries<{
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
        }>>, import("../src").Selected<K, O>>>], keyof import("../src").ReboundSelection<import("../src").From<import("../src").Entries<{
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
        }>>, import("../src").Selected<K, O>> | Exclude<"db", keyof import("../src").ReboundSelection<import("../src").From<import("../src").Entries<{
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
        }>>, import("../src").Selected<K, O>>> | Exclude<"repo", keyof import("../src").ReboundSelection<import("../src").From<import("../src").Entries<{
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
        }>>, import("../src").Selected<K, O>>>> | import("../src/token-types").MissingTokens<import("../src").Merge<import("../src").From<import("../src").Entries<{
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
        }>>, import("../src").Selected<K, O>>> extends infer T_7 extends import("../src/registration").Registrations ? { [K_2 in keyof T_7]: T_7[K_2]; } : never>;
    }>) & import("../src").CheckedScopeLifetimes<NoInfer<import("../src").SharedAliasProviders<import("../src").UnsharedAliases<import("../src").Merge<import("../src").From<import("../src").Entries<{
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
    }>>, import("../src").Selected<K, O>>>> & ([Exclude<((import("../src").Merge<import("../src").From<import("../src").Entries<{
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
    }>>, import("../src").Selected<K, O>>> extends infer T_1 extends import("../src/registration").Registrations ? { [K_2 in keyof T_1]: T_1[K_2]; } : never) extends infer T extends import("../src/registration").Registrations ? { [K_1 in keyof T]: keyof import("../src").ProviderNeeds<T[K_1]>; } : never)[keyof import("../src").ReboundSelection<import("../src").From<import("../src").Entries<{
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
    }>>, import("../src").Selected<K, O>> | Exclude<"db", keyof import("../src").ReboundSelection<import("../src").From<import("../src").Entries<{
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
    }>>, import("../src").Selected<K, O>>> | Exclude<"repo", keyof import("../src").ReboundSelection<import("../src").From<import("../src").Entries<{
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
    }>>, import("../src").Selected<K, O>>>], keyof import("../src").ReboundSelection<import("../src").From<import("../src").Entries<{
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
    }>>, import("../src").Selected<K, O>> | Exclude<"db", keyof import("../src").ReboundSelection<import("../src").From<import("../src").Entries<{
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
    }>>, import("../src").Selected<K, O>>> | Exclude<"repo", keyof import("../src").ReboundSelection<import("../src").From<import("../src").Entries<{
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
    }>>, import("../src").Selected<K, O>>>> | import("../src/token-types").MissingTokens<import("../src").Merge<import("../src").From<import("../src").Entries<{
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
    }>>, import("../src").Selected<K, O>>> extends infer T_2 extends import("../src/registration").Registrations ? { [K_2 in keyof T_2]: T_2[K_2]; } : never>] extends [never] ? [import("../src/token-types").InvalidGraphs<import("../src").Merge<import("../src").From<import("../src").Entries<{
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
    }>>, import("../src").Selected<K, O>>> extends infer T_3 extends import("../src/registration").Registrations ? { [K_2 in keyof T_3]: T_3[K_2]; } : never>] extends [never] ? unknown : import("../src/types").Unsatisfied<"token dependency has an incompatible or opaque contract", {
        tokens: import("../src/token-types").InvalidGraphs<import("../src").Merge<import("../src").From<import("../src").Entries<{
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
        }>>, import("../src").Selected<K, O>>> extends infer T_4 extends import("../src/registration").Registrations ? { [K_2 in keyof T_4]: T_4[K_2]; } : never>;
    }> : import("../src/types").Unsatisfied<"missing factories", {
        missing: Exclude<((import("../src").Merge<import("../src").From<import("../src").Entries<{
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
        }>>, import("../src").Selected<K, O>>> extends infer T_6 extends import("../src/registration").Registrations ? { [K_2 in keyof T_6]: T_6[K_2]; } : never) extends infer T_5 extends import("../src/registration").Registrations ? { [K_1 in keyof T_5]: keyof import("../src").ProviderNeeds<T_5[K_1]>; } : never)[keyof import("../src").ReboundSelection<import("../src").From<import("../src").Entries<{
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
        }>>, import("../src").Selected<K, O>> | Exclude<"db", keyof import("../src").ReboundSelection<import("../src").From<import("../src").Entries<{
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
        }>>, import("../src").Selected<K, O>>> | Exclude<"repo", keyof import("../src").ReboundSelection<import("../src").From<import("../src").Entries<{
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
        }>>, import("../src").Selected<K, O>>>], keyof import("../src").ReboundSelection<import("../src").From<import("../src").Entries<{
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
        }>>, import("../src").Selected<K, O>> | Exclude<"db", keyof import("../src").ReboundSelection<import("../src").From<import("../src").Entries<{
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
        }>>, import("../src").Selected<K, O>>> | Exclude<"repo", keyof import("../src").ReboundSelection<import("../src").From<import("../src").Entries<{
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
        }>>, import("../src").Selected<K, O>>>> | import("../src/token-types").MissingTokens<import("../src").Merge<import("../src").From<import("../src").Entries<{
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
        }>>, import("../src").Selected<K, O>>> extends infer T_7 extends import("../src/registration").Registrations ? { [K_2 in keyof T_7]: T_7[K_2]; } : never>;
    }>) & import("../src").CheckedLifetimes<import("../src").UnsharedAliases<import("../src").Merge<import("../src").From<import("../src").Entries<{
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
