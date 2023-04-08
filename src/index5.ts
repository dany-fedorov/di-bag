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

type Deps<
  DepsConstrainedType extends Record<
    string | number | symbol,
    { deps: readonly (string | number | symbol)[] }
> = {
  [K in keyof DepsConstrainedType]: {
    deps: readonly (keyof DepsConstrainedType)[];
  };
};

export class CT<
  // eslint-disable-next-line @typescript-eslint/ban-types
  FactoriesConstraint extends {},
  // eslint-disable-next-line @typescript-eslint/ban-types
  DepsConstrainedType extends {},
> {
  depsDef: Deps<DepsConstrainedType> | null = null;
  factoriesDef: FactoriesConstraint | null = null;

  // eslint-disable-next-line @typescript-eslint/ban-types
  static begin(): CT<{}, {}> {
    return new CT();
  }

  // deps<
  //   NextDeps extends Record<
  //     string,
  //     { deps: readonly (keyof FactoriesConstraint)[] }
  //   >,
  // >(nextDepsDef: {
  //   [K in keyof NextDeps]: {
  //     deps: readonly (keyof FactoriesConstraint)[];
  //     // factory: (bag: {
  //     //   deps: { [P in NextDeps[K]['deps'][number]]: Factories[P] };
  //     // }) => ReturnType<NextDeps[K]['factory']>;
  //   };
  // }): CT<
  //   Assign<DepsConstrainedType, NextDeps>,
  //   Assign<
  //     FactoriesConstraint,
  //     {
  //       [K in keyof NextDeps]: {
  //         factory: (bag: {
  //           deps: {
  //             [P in NextDeps[K]['deps'][number]]: FactoriesConstraint[P];
  //           };
  //         }) => any; // still cannot constrain here
  //       };
  //     }
  //   >
  // > {
  //   // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  //   // @ts-ignore
  //   this.depsDef = { ...(this.depsDef ?? {}), ...nextDepsDef };
  //   // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  //   // @ts-ignore
  //   return this;
  // }

  factories<NextFactoriesConstraint extends Record<string, (bag: any) => any>>(
    f: NextFactoriesConstraint,
  ): CT<
    Prettify<Assign<FactoriesConstraint, NextFactoriesConstraint>>,
    DepsConstrainedType
  > {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    this.factoriesDef = { ...(this.factoriesDef ?? {}), ...f };
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    return this;
  }
}

// const con = CT.begin()
//   // .factories({
//   //   a: () => 123,
//   // })
//   .deps({
//     a: {
//       deps: [],
//     },
//   } as const);
//
// type T = typeof con.depsDef;
// const a: T = 123;
//
