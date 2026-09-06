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
  FacsConstraint extends {},
  // eslint-disable-next-line @typescript-eslint/ban-types
  DepsConstrainedType extends {},
> {
  depsDef: Deps<DepsConstrainedType> | null = null;
  factoriesDef: FacsConstraint | null = null;

  // eslint-disable-next-line @typescript-eslint/ban-types
  static begin(): CT<{}, {}> {
    return new CT();
  }

  // deps<
  //   NextDeps extends Record<
  //     string,
  //     { deps: readonly (keyof FacsConstraint)[] }
  //   >,
  // >(nextDepsDef: {
  //   [K in keyof NextDeps]: {
  //     deps: readonly (keyof FacsConstraint)[];
  //     // factory: (bag: {
  //     //   deps: { [P in NextDeps[K]['deps'][number]]: Facs[P] };
  //     // }) => ReturnType<NextDeps[K]['factory']>;
  //   };
  // }): CT<
  //   Assign<DepsConstrainedType, NextDeps>,
  //   Assign<
  //     FacsConstraint,
  //     {
  //       [K in keyof NextDeps]: {
  //         factory: (bag: {
  //           deps: {
  //             [P in NextDeps[K]['deps'][number]]: FacsConstraint[P];
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

  factories<NextFacsConstraint extends Record<string, (bag: any) => any>>(
    f: NextFacsConstraint,
  ): CT<
    Prettify<Assign<FacsConstraint, NextFacsConstraint>>,
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
