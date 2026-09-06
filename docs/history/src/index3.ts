export type Assign<OldContext extends object, NewContext extends object> = {
  [Token in keyof ({
    [K in keyof OldContext]: OldContext[K];
  } & {
    [K in keyof NewContext]: NewContext[K];
  })]: Token extends keyof NewContext
    ? NewContext[Token]
    : Token extends keyof OldContext
    ? OldContext[Token]
    : never;
};

export type Prettify<T> = T extends infer U ? { [K in keyof U]: U[K] } : never;

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace MiniDi {
  export class Injector<
    Deps extends Record<
      string,
      { deps: readonly string[]; factory: () => any }
    >,
    Context extends Record<string, any>,
  > {
    constructor(
      public readonly depsDef: {
        [K in keyof Deps]: {
          deps: readonly (keyof Deps)[];
          // factory: (bag: {
          //   deps: Deps[K]['deps'];
          // }) => ReturnType<Deps[K]['factory']>;
        };
      },
      public readonly context: Context,
    ) {}

    static withDeps<
      Deps extends Record<
        string,
        { deps: readonly string[]; factory: () => any }
      >,
    >(depsDef: {
      [K in keyof Deps]: {
        deps: readonly (keyof Deps)[];
        // factory: (bag: {
        //   deps: Deps[K]['deps'];
        // }) => ReturnType<Deps[K]['factory']>;
      };
    }): Injector<Deps, Record<string, never>> {
      return new Injector(depsDef, {});
    }

    addFacs<Facs extends Record<keyof Deps, () => any>>(
      factories: Facs,
    ): Injector<Deps, Prettify<Assign<Context, Facs>>>;
  }
}
