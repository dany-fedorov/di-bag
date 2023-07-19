import type { ValBox } from 'val-box';
import type { SasBox } from 'sas-box';

type Assign<OldContext extends object, NewContext extends object> = {
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

type Prettify<T> = T extends infer U ? { [K in keyof U]: U[K] } : never;

export class DiBag {
  static begin(): DiBag.Tmpl.Begin {
    return null as any;
  }
}

export namespace DiBag {
  export type DepsInThisBagType = Record<string, string | string[]>;
  export type DepsOfThisBagType = any[]; // Final Bag Version

  export type TypesUnboxedInputType<TValue = any> = Record<string, TValue>;

  export type TypesType<TValue = any, TMetadata = any> = Record<
    string,
    ValBox.Unknown<TValue, TMetadata>
  >;

  export type TypesFromTypesUnboxedInput<
    TTypes extends DiBag.TypesType,
    TTypesUnboxedInput extends TypesUnboxedInputType,
  > = Prettify<
    Assign<
      TTypes,
      {
        [Token in keyof TTypesUnboxedInput]: TTypesUnboxedInput[Token] extends ValBox.Unknown<
          any,
          any
        >
          ? TTypesUnboxedInput[Token]
          : undefined extends TTypesUnboxedInput[Token]
          ? ValBox.NoValue<any>
          : ValBox.WithValue<TTypesUnboxedInput[Token], any>;
      }
    >
  >;

  export type FacsType<
    TFacs extends DiBag.FacsType<any, any, any> = any,
    TValue = any,
    TMetadata = any,
  > = Record<
    string,
    (args: DiBag.FactoryArgs<TFacs>) => ValBox.Unknown<TValue, TMetadata>
  >;

  export type FacsTypePartial<
    TFacs extends DiBag.FacsType<any, any, any> = any,
    TValue = any,
    TMetadata = any,
  > = Record<
    string,
    | ((args: DiBag.FactoryArgs<TFacs>) => ValBox.Unknown<TValue, TMetadata>)
    | undefined
  >;

  export type FacsUnboxedInputType<
    TFacs extends DiBag.FacsType = any,
    TTypesHere extends Record<string, ValBox.Unknown<any, any>> = Record<
      string,
      ValBox.Unknown<any, any>
    >,
  > = {
    [Token in keyof TTypesHere]?: (
      args: DiBag.FactoryArgs<TFacs>,
    ) => ReturnType<TTypesHere[Token]['getValue']>;
  } & {
    [Token in Exclude<string, keyof TTypesHere | keyof TFacs>]: (
      args: DiBag.FactoryArgs<TFacs>,
    ) => any;
  } & {
    [Token in keyof TFacs]?: never; // Already declared
  };

  export type FactoryArgs<TFacs extends DiBag.FacsType> = {
    token: string;
    access: DiBag.Accessor.PartiallyResolved<{}, TFacs>;
    // TODO: Remove factory functions
    factories: TFacs;
    // getFactory: <TToken extends keyof TFacs>(token: TToken) => TFacs[TToken];
  };

  export type FacsFromFacsUnboxedInput<
    TFacs extends DiBag.FacsType,
    TNewFacsUnboxedInput extends DiBag.FacsUnboxedInputType,
  > = Prettify<
    Assign<
      TFacs,
      {
        [Token in keyof TNewFacsUnboxedInput]: (
          args: DiBag.FactoryArgs<TFacs>,
        ) => ReturnType<TNewFacsUnboxedInput[Token]> extends ValBox.Unknown<
          any,
          any
        >
          ? ReturnType<TNewFacsUnboxedInput[Token]>
          : undefined extends ReturnType<TNewFacsUnboxedInput[Token]>
          ? ValBox.NoValue<any>
          : ValBox.WithValue<ReturnType<TNewFacsUnboxedInput[Token]>, any>;
      }
    >
  >;

  export namespace Accessor {
    export type CallFactoryOptions = {
      cache:
        | boolean
        | {
            doNotCacheResult?: boolean;
            useCacheBeforeUsingFactory?: boolean;
          };
    };

    type ToMoreResolvedAccessorMethods<TFacs extends DiBag.FacsType> = {
      toFullyResolvedAccessor: (
        options?: CallFactoryOptions,
      ) => SasBox.Async<FullyResolved<TFacs>>;
      /**
       * TODO: Try to make a PartiallyResolved type where resolved keys are specified, not sure it is worth it though.
       * Current PartiallyResolved does not give a way to know which keys are resolved and which are not.
       * But maybe this is ok.
       */
      toPartiallyResolvedAccessor: (
        tokens: (keyof TFacs)[],
      ) => SasBox.Async<PartiallyResolved<TFacs, {}>>;
      toMoreResolvedAccessor: <TokenList extends (keyof TFacs)[]>(
        tokens: TokenList,
      ) => SasBox.Async<
        PartiallyResolved<
          Omit<TFacs, TokenList[number]>,
          Pick<TFacs, TokenList[number]>
        >
      >;
    };

    export type Unresolved<TFacs extends DiBag.FacsType> =
      ToMoreResolvedAccessorMethods<TFacs> & {
        unresolved: UnresolvedOpsFacade<TFacs>;
      };

    export type PartiallyResolved<
      TFacsPartial extends DiBag.FacsType,
      TFacsFull extends DiBag.FacsType,
    > = ToMoreResolvedAccessorMethods<TFacsPartial & TFacsFull> & {
      unresolved: UnresolvedOpsFacade<TFacsPartial & TFacsFull>;
      resolved: ResolvedOpsFacade<TFacsFull>;
    };

    export type FullyResolved<TFacs extends DiBag.FacsType> =
      ToMoreResolvedAccessorMethods<TFacs> & {
        unresolved: UnresolvedOpsFacade<TFacs>;
        resolved: ResolvedOpsFacade<TFacs>;
      };

    export type UnresolvedOpsFacade<TFacs extends DiBag.FacsType> = {
      callFactory: <Token extends keyof TFacs | string>(
        token: Token,
        options?: CallFactoryOptions,
      ) => Token extends keyof TFacs
        ? ReturnType<TFacs[Token]>
        :
            | ValBox.Unknown<unknown, unknown>
            | Promise<ValBox.Unknown<unknown, unknown>>;
    };

    export type ResolvedOpsFacade<TFacs extends DiBag.FacsType> = {
      values: {
        [K in keyof TFacs]: ReturnType<ReturnType<TFacs[K]>['getValue']>;
      };
      metadata: {
        [K in keyof TFacs]: ReturnType<ReturnType<TFacs[K]>['getMetadata']>;
      };
      boxes: {
        [K in keyof TFacs]: ReturnType<TFacs[K]>;
      };
    };
  }

  // export type UniversalDotAddProvider<
  //   TDepsOfThisBag extends DiBag.DepsOfThisBagType,
  //   TDepsInThisBag extends DiBag.DepsInThisBagType,
  // > = {
  //   factories: <TNewFacsUnboxedInput extends DiBag.FacsUnboxedInputType>(
  //     unboxed: TNewFacsUnboxedInput,
  //   ) => DiBag.Tmpl<DiBag.FacsFromFacsUnboxedInput<{}, TNewFacsUnboxedInput>>;
  //   types: any;
  //   injections: any;
  // };

  export namespace Tmpl {
    export class Interim<
      TDepsOfThisBag extends DiBag.DepsOfThisBagType,
      TDepsInThisBag extends DiBag.DepsInThisBagType,
      TTypes extends DiBag.TypesType,
      TFacs extends DiBag.FacsType,
    > {
      add: DiBag.Tmpl.Interim.DotAddProvider<
        TDepsOfThisBag,
        TDepsInThisBag,
        TTypes,
        TFacs
      > = null as any;
      deps: DiBag.Tmpl.Interim.DotDepsProvider<
        TDepsOfThisBag,
        TDepsInThisBag,
        TTypes,
        TFacs
      > = null as any;

      constructor(public readonly icfg: { factories: TFacs }) {}
    }

    export namespace Interim {
      export type DotDepsProvider<
        TDepsOfThisBag extends DiBag.DepsOfThisBagType,
        TDepsInThisBag extends DiBag.DepsInThisBagType,
        TTypes extends DiBag.TypesType,
        TFacs extends DiBag.FacsType,
      > = {
        inThisBag: <TNewDepsInThisBagInput extends DiBag.DepsInThisBagType>(
          internalDeps: TNewDepsInThisBagInput,
        ) => DiBag.Tmpl.Interim<
          TDepsOfThisBag,
          Assign<TDepsInThisBag, TNewDepsInThisBagInput>,
          TTypes,
          TFacs
        >;
        ofThisBag: <TNewDepsOfThisBagInput extends DiBag.DepsOfThisBagType>(
          externalDeps: TNewDepsOfThisBagInput,
        ) => DiBag.Tmpl.Interim<
          Assign<TDepsOfThisBag, TNewDepsOfThisBagInput>,
          TDepsInThisBag,
          TTypes,
          TFacs
        >;
      };

      export type DotAddProvider<
        TDepsOfThisBag extends DiBag.DepsOfThisBagType,
        TDepsInThisBag extends DiBag.DepsInThisBagType,
        TTypes extends DiBag.TypesType,
        TFacs extends DiBag.FacsType,
      > = {
        types: unknown;
        factories: <
          TNewFacsUnboxedInput extends DiBag.FacsUnboxedInputType<
            TFacs,
            {
              [Token in Exclude<keyof TTypes, keyof TFacs>]: TTypes[Token];
            }
          >,
        >(
          unboxed: TNewFacsUnboxedInput,
        ) => DiBag.Tmpl.Interim<
          TDepsOfThisBag,
          TDepsInThisBag,
          TTypes,
          FacsFromFacsUnboxedInput<TFacs, TNewFacsUnboxedInput>
        >;
      };
    }

    // export class WithDeps<
    //   TDepsOfThisBag extends DiBag.DepsOfThisBagType,
    //   TDepsInThisBag extends DiBag.DepsInThisBagType,
    // > {
    //   add: DiBag.Tmpl.WithDeps.DotAddProvider<TDepsOfThisBag, TDepsInThisBag> =
    //     null as any;
    //   deps: DiBag.Tmpl.WithDeps.DotDepsProvider<TDepsOfThisBag, TDepsInThisBag> =
    //     null as any;
    // }
    //
    // export namespace WithDeps {
    //   export type DotAddProvider<TDepsOfThisBag, TDepsInThisBag> = {};
    // }

    export class WithFacs<TFacs extends DiBag.FacsType> {
      add: DiBag.Tmpl.WithFacs.DotAddProvider<TFacs> = null as any;

      constructor(public readonly icfg: { factories: TFacs }) {}
    }

    export namespace WithFacs {
      export type DotAddProvider<TFacs extends DiBag.FacsType> = {
        factories: <
          TNewFacsUnboxedInput extends DiBag.FacsUnboxedInputType<TFacs>,
        >(
          unboxed: TNewFacsUnboxedInput,
        ) => DiBag.Tmpl.WithFacs<
          FacsFromFacsUnboxedInput<TFacs, TNewFacsUnboxedInput>
        >;
      };
    }

    export class Begin {
      add: DiBag.Tmpl.Begin.DotAddProvider = null as any;
      deps: DiBag.Tmpl.Begin.DotDepsProvider = null as any;
    }

    export namespace Begin {
      export type DotAddProvider = {
        factories: <TNewFacsUnboxedInput extends DiBag.FacsUnboxedInputType>(
          unboxed: TNewFacsUnboxedInput,
        ) => DiBag.Tmpl.Interim<
          [],
          {},
          {},
          DiBag.FacsFromFacsUnboxedInput<{}, TNewFacsUnboxedInput>
        >;
        types: <
          TNewTypesUnboxedInput extends DiBag.TypesUnboxedInputType,
        >() => DiBag.Tmpl.Interim<
          [],
          {},
          DiBag.TypesFromTypesUnboxedInput<{}, TNewTypesUnboxedInput>,
          {}
        >;
      };

      export type DotDepsProvider = {
        inThisBag: <TNewDepsInThisBagInput extends DiBag.DepsInThisBagType>(
          internalDeps: TNewDepsInThisBagInput,
        ) => DiBag.Tmpl.Interim<[], TNewDepsInThisBagInput, {}, {}>;
        ofThisBag: <TNewDepsOfThisBagInput extends DiBag.DepsOfThisBagType>(
          externalDeps: TNewDepsOfThisBagInput,
        ) => DiBag.Tmpl.Interim<TNewDepsOfThisBagInput, {}, {}, {}>;
      };
    }
  }
}

const main = () => {
  // type should fail
  const bag = DiBag.begin()
    .add.types<{
      a: { hoh: 2; hey: 1 };
      b: 'hey';
      d: 'opana';
      ff: 'heyhey';
    }>()
    .add.factories({
      a: () => ({ hey: 1, hoh: 2 }),
      b: () => 'hey',
      c: () => '9999' as const,
      d: () => 'opana',
      // d: () => 'opana',
      // a: () => 'hey',
    })
    .add.factories({
      ff: () => 'heyhey3',
      d: () => 123,
    });
  // .add.types<{
  //   e: '9999';
  // }>()
  // .add.factories({
  //   e: ({ access }) => access.resolved.boxes.c.getValue(),
  // });
  // const bag0 = DiBag.begin().add.factories({ a: () => 888 });
  // const bag00 = DiBag.begin().add.factories({ a: () => 888 });
  // const bag000 = DiBag.begin().add.factories({ a: () => 888 });
  // const bag1 = DiBag.begin()
  //   // .deps.ofThisBag([bag0, bag00])
  //   // .deps.inThisBag({
  //   //   a3: ['a4', bag000],
  //   // })
  //   // .add.types<{
  //   //   a: 1235; // should throw when factory for "a" returns not 12345
  //   // }>()
  //   // .add.injections({
  //   //   customThing: 'literally anything',
  //   // })
  //   .add.factories({
  //     a: () => 123,
  //     aa: () => 123 as const,
  //     aaa: ({ access }) => {
  //       return access.unresolved.callFactory('123');
  //     },
  //   })
  //   .add.factories({
  //     b: () => 'hey' as const,
  //     bb: ({ access }) => {
  //       const f = access.resolved.boxes.aa.getValue();
  //       return f;
  //     },
  //     bbb: async ({ access }) => {
  //       const r = await access.unresolved.callFactory('bb');
  //       const rr1 = access.resolved.boxes.aa.getValue();
  //       const rr2 = access.resolved.values.aa;
  //       const rr3 = access.resolved.metadata.aa;
  //     },
  //   })
  //   .add.factories({
  //     c: () =>
  //       new ValBox.WithValue.WithMetadata('hah3' as const, 'hahmeta' as const),
  //   })
  //   .add.factories({
  //     d: (args) => {
  //       // return 123;
  //       return args.factories.c(null as any).getValue();
  //     },
  //   });
  // const re = bag1.icfg.factories
  //   .a(null as any)
  //   .assertHasValue()
  //   .getValue();
  // const re2 = bag1.icfg.factories
  //   .b(null as any)
  //   .assertHasValue()
  //   .getValue();
  // const re2 = bag1.icfg.factories.a(null as any).getValue();
  // const re22 = bag1.icfg.factories.aa(null as any).getValue();
  // const re222 = bag1.icfg.factories.aaa(null as any).getValue();
  // const re3 = bag1.icfg.factories.c(null as any).getValue();
  // const re3m = bag1.icfg.factories.c(null as any).getMetadata();
  // const re4 = bag1.icfg.factories.d(null as any).getValue();
};

// TODO next: 1. Work on deps plugin as in final-design-2.md.
// TODO next: 2. Implement .injections as in final-design.md.
// TODO next: 3. Implement withTypeProvider as in final-design-2.md.

// TODO next: 999. Add event emitter

main();
