import { ValBox } from 'val-box';

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

  export type FacsUnboxedInputType<
    TFacs extends DiBag.FacsType<any, any, any> = any,
    TValue = any,
  > = Record<string, (args: DiBag.FactoryArgs<TFacs>) => TValue>;

  export type FactoryArgs<TFacs extends DiBag.FacsType> = {
    token: string;
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

  export namespace Tmpl {
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
    }

    export namespace Begin {
      export type DotAddProvider = {
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
    })
    .add.factories({
      b: () => 'hey' as const,
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
  const re3 = bag1.icfg.factories.c(null as any).getValue();
  const re3m = bag1.icfg.factories.c(null as any).getMetadata();
  const re4 = bag1.icfg.factories.d(null as any).getValue();
};
