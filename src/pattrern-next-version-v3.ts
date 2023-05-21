import { ValBox } from 'val-box';
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
    TFacs extends DiBag.FacsType<any, any, any> = any,
    TValue = any,
  > = Record<string, (args: DiBag.FactoryArgs<TFacs>) => TValue>;

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
        [K in keyof TNewFacsUnboxedInput]: (
          args: DiBag.FactoryArgs<TFacs>,
        ) => ReturnType<TNewFacsUnboxedInput[K]> extends ValBox.Unknown<
          any,
          any
        >
          ? ReturnType<TNewFacsUnboxedInput[K]>
          : undefined extends ReturnType<TNewFacsUnboxedInput[K]>
          ? ValBox.NoValue<any>
          : ValBox.WithValue<ReturnType<TNewFacsUnboxedInput[K]>, any>;
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

  export namespace Tmpl {
    export class WithFacs<TFacs extends DiBag.FacsType> {
      add: DiBag.Tmpl.WithFacs.AddProvider<TFacs> = null as any;

      constructor(public readonly icfg: { factories: TFacs }) {}
    }

    export namespace WithFacs {
      export type AddProvider<TFacs extends DiBag.FacsType> = {
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
      add: DiBag.Tmpl.Begin.AddProvider = null as any;
      deps: DiBag.Tmpl.Begin.DepsProvider = null as any;
    }

    export namespace Begin {
      export type AddProvider = {
        factories: <TNewFacsUnboxedInput extends DiBag.FacsUnboxedInputType>(
          unboxed: TNewFacsUnboxedInput,
        ) => DiBag.Tmpl.WithFacs<
          DiBag.FacsFromFacsUnboxedInput<{}, TNewFacsUnboxedInput>
        >;
        types: any;
        injections: any;
      };

      export type DepsProvider = {
        ofThisBag: any;
        ofThisBagTokens: any;
      };
    }
  }
}

const main = () => {
  const bag0 = DiBag.begin().add.factories({ a: () => 888 });
  const bag00 = DiBag.begin().add.factories({ a: () => 888 });
  const bag000 = DiBag.begin().add.factories({ a: () => 888 });
  const bag1 = DiBag.begin()
    // .deps.ofThisBag([bag0, bag00])
    // .deps.ofThisBagTokens({
    //   a3: ['a4', bag000],
    // })
    // .add.types<{
    //   a: 1235; // should throw when factory for "a" returns not 12345
    // }>()
    // .add.injections({
    //   customThing: 'literally anything',
    // })
    .add.factories({
      a: () => 123,
      aa: () => 123 as const,
      aaa: ({ access }) => {
        return access.unresolved.callFactory('123');
      },
    })
    .add.factories({
      b: () => 'hey' as const,
      bb: ({ access }) => {
        const f = access.resolved.boxes.aa.getValue();
        return f;
      },
      bbb: async ({ access }) => {
        const r = await access.unresolved.callFactory('bb');
        const rr1 = access.resolved.boxes.aa.getValue();
        const rr2 = access.resolved.values.aa;
        const rr3 = access.resolved.metadata.aa;
      },
    })
    .add.factories({
      c: () =>
        new ValBox.WithValue.WithMetadata('hah3' as const, 'hahmeta' as const),
    })
    .add.factories({
      d: (args) => {
        // return 123;
        return args.factories.c(null as any).getValue();
      },
    });
  const re = bag1.icfg.factories
    .a(null as any)
    .assertHasValue()
    .getValue();
  const re2 = bag1.icfg.factories
    .b(null as any)
    .assertHasValue()
    .getValue();
  const re2 = bag1.icfg.factories.a(null as any).getValue();
  const re22 = bag1.icfg.factories.aa(null as any).getValue();
  const re222 = bag1.icfg.factories.aaa(null as any).getValue();
  const re3 = bag1.icfg.factories.c(null as any).getValue();
  const re3m = bag1.icfg.factories.c(null as any).getMetadata();
  const re4 = bag1.icfg.factories.d(null as any).getValue();
};

// TODO next: 1. Work on deps plugin as in final-design-2.md.
// TODO next: 2. Implement .injections as in final-design.md.
// TODO next: 3. Implement withTypeProvider as in final-design-2.md.

// TODO next: 999. Add event emitter

main();
