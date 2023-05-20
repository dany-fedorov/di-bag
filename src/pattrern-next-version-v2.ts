import { ValBox } from 'val-box';
import { SasBox } from 'sas-box';

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
    unresolved: DiBag.Accessor.Unresolved<TFacs>;
    resolved: DiBag.Accessor.Resolved<TFacs>;
    // TODO: Remove factory functions
    factories: TFacs;
    getFactory: <TToken extends keyof TFacs>(token: TToken) => TFacs[TToken];
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
    type ResolveMethods<TFacs extends DiBag.FacsType> = {
      resolveAll: SasBox.Async<Resolved<TFacs>>;
      /**
       * TODO: Try to make a PartiallyResolved type where resolved keys are specified, not sure it is worth it though.
       * Current PartiallyResolved does not give a way to know which keys are resolved and which are not.
       * But maybe this is ok.
       */
      resolveSome: (
        tokens: (keyof TFacs)[],
      ) => SasBox.Async<PartiallyResolved<TFacs>>;
    };

    export type Unresolved<TFacs extends DiBag.FacsType> =
      ResolveMethods<TFacs> & {
        unresolved: UnresolvedFacade<TFacs>;
      };

    export type PartiallyResolved<TFacs extends DiBag.FacsType> =
      ResolveMethods<TFacs> & {
        unresolved: UnresolvedFacade<TFacs>;
        resolved: PartiallyResolvedFacade<Partial<TFacs>>;
      };

    export type Resolved<TFacs extends DiBag.FacsType> =
      ResolveMethods<TFacs> & {
        unresolved: UnresolvedFacade<TFacs>;
        resolved: ResolvedFacade<TFacs>;
      };

    export type UnresolvedFacade<TFacs extends DiBag.FacsType> = {
      resolve: <Token extends keyof TFacs | string>(
        token: Token,
        options?: Unresolved.ResolveTokenOptions,
      ) => Token extends keyof TFacs
        ? ReturnType<TFacs[Token]>
        : ValBox.Unknown<unknown, unknown>;
    };

    export namespace Unresolved {
      export type ResolveTokenOptions = {
        cache:
          | boolean
          | {
              doNotCacheResult?: boolean;
              useCacheBeforeUsingFactory?: boolean;
            };
      };
    }

    /**
     * TODO: I think this should work as intended - but I need to spend more time on this
     */
    export type PartiallyResolvedFacade<TFacs extends DiBag.FacsTypePartial> = {
      values: {
        [K in keyof TFacs]: TFacs[K] extends undefined
          ? never
          : ReturnType<ReturnType<Exclude<TFacs[K], undefined>>['getValue']>;
      };
      metadata: {
        [K in keyof TFacs]: TFacs[K] extends undefined
          ? never
          : ReturnType<ReturnType<Exclude<TFacs[K], undefined>>['getMetadata']>;
      };
      boxes: {
        [K in keyof TFacs]: TFacs[K] extends undefined
          ? never
          : ReturnType<Exclude<TFacs[K], undefined>>;
      };
    };

    export type ResolvedFacade<TFacs extends DiBag.FacsType> = {
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
    }

    export namespace Begin {
      export type AddProvider = {
        factories: <TNewFacsUnboxedInput extends DiBag.FacsUnboxedInputType>(
          unboxed: TNewFacsUnboxedInput,
        ) => DiBag.Tmpl.WithFacs<
          DiBag.FacsFromFacsUnboxedInput<{}, TNewFacsUnboxedInput>
        >;
      };
    }
  }
}

const main = () => {
  const bag1 = DiBag.begin()
    .add.factories({
      a: () => 123,
      aa: () => 123 as const,
      aaa: ({ unresolved }) => {
        return unresolved.resolve('123');
      },
    })
    .add.factories({
      b: () => 'hey' as const,
      bb: ({ resolved }) => {
        return resolved.boxes.aaa;
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
