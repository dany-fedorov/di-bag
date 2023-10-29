import type { ValBox } from 'val-box';

namespace TypeUtils {
  // https://www.typescriptlang.org/play?ssl=3&ssc=1&pln=4&pc=1#code/C4TwDgpgBAqgdgSwPZwCpIJJ2BATgZwgGNhk4AeGAPigF4oAKGKCADxzgBN8oBDOEFAD8jXrgDmALlgBKOjX6DpcCADc8cth26MGYqVARwAZnigY5tGqqQJOckRijK1eAFChIUVHSgBtAG8oY14SJFwECHxpIN5pAEYoAF9kgBooIJCwiKiYqAAjaQAmZOSAXQ9waFQfengydCwcAmJSFHJUPzgAVwBbfLwyvwByLOBwyPxhsqo3NyIUfGAoJGka3wC3KG2+BNStncKoIrckoA
  // https://github.com/type-challenges/type-challenges/blob/main/questions/00055-hard-union-to-intersection/README.md
  export type UnionToIntersection<U> = (
    U extends any ? (arg: U) => any : never
  ) extends (arg: infer I) => void
    ? I
    : never;

  // https://github.com/type-challenges/type-challenges
  // export type TupleToUnion<T> = T extends Array<infer ITEMS> ? ITEMS : never;
  // export type TupleToUnion<T extends readonly string[]> = T extends Array<
  //   infer R
  // >
  //   ? R
  //   : never;
  export type TupleToUnion<T extends ArrayLike<any>> = T extends [
    infer F,
    ...infer Last,
  ]
    ? TupleToUnion<Last> | F
    : never;

  export declare type Intersection<T extends object, U extends object> = Pick<
    T,
    Extract<keyof T, keyof U> & Extract<keyof U, keyof T>
  >;

  // https://github.com/type-challenges/type-challenges/blob/main/utils/index.d.ts
  export type Equal<X, Y> = (<T>() => T extends X ? 1 : 2) extends <
    T,
  >() => T extends Y ? 1 : 2
    ? true
    : false;

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

  export type Prettify<T> = T extends infer U
    ? { [K in keyof U]: U[K] }
    : never;

  declare const __brand: unique symbol;

  // https://twitter.com/mattpocockuk/status/1625173884885401600?s=20
  export type Brand<T, TBrand extends string> = T & {
    [__brand]: TBrand;
  };
}

export class DiBag<
  TDepsInThisBag extends Record<string, readonly string[]>,
  TTypes extends DiBag.TypesType,
  TFacs extends DiBag.FacsType,
> {
  deps: {
    inThisBag: TDepsInThisBag;
  };
  factories: TFacs;

  static begin(): DiBag.Tmpl.Begun {
    return null as any;
  }

  constructor(
    deps: {
      inThisBag: TDepsInThisBag;
    },
    factories: TFacs,
  ) {
    this.deps = deps;
    this.factories = factories;
  }
}

export namespace DiBag {
  // TODO: Try to think how to improve this one
  export type TypeException<
    ErrorMessage extends string,
    ErrorProps extends Record<string, any> = {},
  > = TypeUtils.Brand<
    {
      DI_BAG_ERROR_MESSAGE: ErrorMessage;
    } & {
      [PropKey in keyof ErrorProps &
        string as `DI_BAG_ERROR_PROP__${Capitalize<PropKey>}`]: PropKey;
    },
    'DiBag.TypeException'
  >;

  export type DepsInThisBagType<
    TToken extends string = string,
    TValue extends readonly string[] = readonly string[],
  > = Record<TToken, TValue>;

  export type TypesUnboxedInputType<TValue = any> = Record<string, TValue>;

  export type TypesType<TValue = any, TMetadata = any> = Record<
    string,
    ValBox.Unknown<TValue, TMetadata>
  >;

  export type TypesFromTypesUnboxedInput<
    TTypes extends DiBag.TypesType,
    TTypesUnboxedInput extends TypesUnboxedInputType,
  > = TypeUtils.Prettify<
    TypeUtils.Assign<
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

  // export type FacsTypePartial<
  //   TFacs extends DiBag.FacsType<any, any, any> = any,
  //   TValue = any,
  //   TMetadata = any,
  // > = Record<
  //   string,
  //   | ((args: DiBag.FactoryArgs<TFacs>) => ValBox.Unknown<TValue, TMetadata>)
  //   | undefined
  // >;

  export type FacsUnboxedInputType<
    TDepsInThisBag extends Record<string, readonly string[]>,
    TFacs extends DiBag.FacsType = any,
    TTypesHere extends Record<string, ValBox.Unknown<any, any>> = Record<
      string,
      ValBox.Unknown<any, any>
    >,
    // prettier-ignore
    TDepsKeys extends string =
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
        | {
      [K in keyof TDepsInThisBag]: TDepsInThisBag[K] extends readonly (infer ITEM)[]
        ? ITEM
        : never;
    }[keyof TDepsInThisBag]
      | keyof TDepsInThisBag,
    /*    TDepsKeys = {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          [Token in (({
            [K in keyof TDepsInThisBag]: TDepsInThisBag[K] extends readonly (infer ITEM)[]
              ? ITEM
              : never;
          })[keyof TDepsInThisBag] | keyof TDepsInThisBag)]: 123
        }*/
  > = {
    // question mark here is the difference
    [Token in keyof TTypesHere]: (
      args: DiBag.FactoryArgs<TFacs>,
    ) => ReturnType<TTypesHere[Token]['getValue']>;
    // question mark here is the difference
  } & {
    [Token in TDepsKeys]: (args: DiBag.FactoryArgs<TFacs>) => any;
  } & {
    [Token in Exclude<string, TDepsKeys | keyof TTypesHere | keyof TFacs>]: (
      args: DiBag.FactoryArgs<TFacs>,
    ) => any;
  } & {
    [Token in keyof TFacs]?: DiBag.TypeException<
      'Already declared',
      {
        type_of_already_declared_token: ReturnType<
          ReturnType<TFacs[Token]>['getValue']
        >;
      }
    >;
  };

  export type FacsUnboxedInputPartialType<
    TDepsInThisBag extends Record<string, readonly string[]>,
    TFacs extends DiBag.FacsType = any,
    TTypesHere extends Record<string, ValBox.Unknown<any, any>> = Record<
      string,
      ValBox.Unknown<any, any>
    >,
    // prettier-ignore
    TDepsKeys extends string =
      // DF: It actually works, but TypeScript does not know about it (?) or is this just the editor?
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment 
      // @ts-ignore 
        | {
      [K in keyof TDepsInThisBag]: TDepsInThisBag[K] extends readonly (infer ITEM)[]
        ? ITEM
        : never;
    }[keyof TDepsInThisBag]
      | keyof TDepsInThisBag,
    /*    TDepsKeys = {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          [Token in (({
            [K in keyof TDepsInThisBag]: TDepsInThisBag[K] extends readonly (infer ITEM)[]
              ? ITEM
              : never;
          })[keyof TDepsInThisBag] | keyof TDepsInThisBag)]: 123
        }*/
  > = {
    // question mark here is the difference
    [Token in keyof TTypesHere]?: (
      args: DiBag.FactoryArgs<TFacs>,
    ) => ReturnType<TTypesHere[Token]['getValue']>;
    // question mark here is the difference
  } & {
    [Token in TDepsKeys]?: (args: DiBag.FactoryArgs<TFacs>) => any;
  } & {
    [Token in Exclude<string, TDepsKeys | keyof TTypesHere | keyof TFacs>]: (
      args: DiBag.FactoryArgs<TFacs>,
    ) => any;
  } & {
    [Token in keyof TFacs]?: DiBag.TypeException<
      'Already declared',
      {
        type_of_already_declared_token: ReturnType<
          ReturnType<TFacs[Token]>['getValue']
        >;
      }
    >;
  };

  export type CallFactoryOptions = {
    cache:
      | boolean
      | {
          doNotCacheResult?: boolean;
          useCacheBeforeUsingFactory?: boolean;
        };
  };

  export type FactoryArgs<TFacs extends DiBag.FacsType> = {
    token: string;
    factories: TFacs;
    callFactory: <Token extends keyof TFacs | string>(
      token: Token,
      options?: CallFactoryOptions,
    ) => Token extends keyof TFacs
      ? ReturnType<TFacs[Token]>
      :
          | ValBox.Unknown<unknown, unknown>
          | Promise<ValBox.Unknown<unknown, unknown>>;
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

  export type FacsFromFacsUnboxedInput<
    TFacs extends DiBag.FacsType,
    TNewFacsUnboxedInput extends DiBag.FacsUnboxedInputType<{}>, // TODO: Is this default ( {} ) OK here?
  > = TypeUtils.Prettify<
    TypeUtils.Assign<
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
      TDepsInThisBag extends Record<string, readonly string[]>,
      TTypes extends DiBag.TypesType,
      TFacs extends DiBag.FacsType,
    > {
      add: DiBag.Tmpl.Interim.DotAddProvider<TDepsInThisBag, TTypes, TFacs> =
        null as any;
      deps: DiBag.Tmpl.Interim.DotDepsProvider<TDepsInThisBag, TTypes, TFacs> =
        null as any;
      end: DiBag.Tmpl.Interim.DotEndProvider<TDepsInThisBag, TTypes, TFacs> =
        null as any;

      constructor(
        public readonly icfg: {
          factories: TFacs;
        },
      ) {}
    }

    export namespace Interim {
      // export type DotEndProvider = any;
      export type DotEndProvider<
        TDepsInThisBag extends DiBag.DepsInThisBagType,
        TTypes extends DiBag.TypesType = any,
        TFacs extends DiBag.FacsType = any,
        // prettier-ignore
        TDepsKeys extends string =
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment 
          // @ts-ignore 
            | {
          [K in keyof TDepsInThisBag]: TDepsInThisBag[K] extends readonly (infer ITEM)[]
            ? ITEM
            : never;
        }[keyof TDepsInThisBag]
          | keyof TDepsInThisBag,
      > = TypeUtils.Equal<keyof TTypes, keyof TFacs & keyof TTypes> extends true
        ? TypeUtils.Equal<TDepsKeys, keyof TFacs & TDepsKeys> extends true
          ? () => DiBag<TDepsInThisBag, TTypes, TFacs>
          : DiBag.TypeException<
              'Cannot finalize this DiBag because not all declared dependencies are implemented in factories.',
              {
                missing_factories: Exclude<TDepsKeys, keyof TFacs>;
              }
            >
        : DiBag.TypeException<
            'Cannot finalize this DiBag because not all declared types are implemented in factories.',
            {
              missing_factories: Exclude<keyof TTypes, keyof TFacs>;
            }
          >;

      export type DotDepsProvider<
        TDepsInThisBag extends DiBag.DepsInThisBagType,
        TTypes extends DiBag.TypesType,
        TFacs extends DiBag.FacsType,
      > = {
        inThisBag: <TNewDepsInThisBagInput extends DiBag.DepsInThisBagType>(
          internalDeps: TNewDepsInThisBagInput,
        ) => DiBag.Tmpl.Interim<
          TypeUtils.Assign<TDepsInThisBag, TNewDepsInThisBagInput>,
          TTypes,
          TFacs
        >;
      };

      export type DotAddProvider<
        // TDepsInThisBag extends DiBag.DepsInThisBagType,
        TDepsInThisBag extends Record<string, readonly string[]>,
        TTypes extends DiBag.TypesType,
        TFacs extends DiBag.FacsType,
      > = {
        types: <
          TNewTypesUnboxedInput extends DiBag.TypesUnboxedInputType,
        >() => DiBag.Tmpl.Interim<
          TDepsInThisBag,
          DiBag.TypesFromTypesUnboxedInput<{}, TNewTypesUnboxedInput>,
          TFacs
        >;
        bag: <
          FacsContainer extends {
            factories: FacsType;
          },
        >(
          c: FacsContainer,
        ) => DiBag.Tmpl.Interim<
          {},
          {},
          TypeUtils.Assign<TFacs, FacsContainer['factories']>
        >;
        factories: <
          TNewFacsUnboxedInput extends DiBag.FacsUnboxedInputPartialType<
            TDepsInThisBag,
            TFacs,
            {
              [Token in Exclude<keyof TTypes, keyof TFacs>]: TTypes[Token];
            }
            // {
            //   [K in keyof TDepsInThisBag]: TDepsInThisBag[K] extends readonly (infer ITEM)[]
            //   ? ITEM
            //   : never;
            // }
            // {
            //   [Token in ]: ValBox.Unknown<any, any>
            //   //   [Token in {
            //   //   [K in keyof TDepsInThisBag]: TypeUtils.TupleToUnion<
            //   //     TDepsInThisBag[K]
            //   //   >;
            //   // }[keyof TDepsInThisBag]]: ValBox.Unknown<any, any>;
            // }
          >,
        >(
          unboxed: TNewFacsUnboxedInput,
        ) => DiBag.Tmpl.Interim<
          TDepsInThisBag,
          TTypes,
          DiBag.FacsFromFacsUnboxedInput<TFacs, TNewFacsUnboxedInput>
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

    // export class WithFacs<TFacs extends DiBag.FacsType> {
    //   add: DiBag.Tmpl.WithFacs.DotAddProvider<TFacs> = null as any;
    //
    //   constructor(public readonly icfg: { factories: TFacs }) {}
    // }
    //
    // export namespace WithFacs {
    //   export type DotAddProvider<TFacs extends DiBag.FacsType> = {
    //     factories: <
    //       TNewFacsUnboxedInput extends DiBag.FacsUnboxedInputType<TFacs>,
    //     >(
    //       unboxed: TNewFacsUnboxedInput,
    //     ) => DiBag.Tmpl.WithFacs<
    //       FacsFromFacsUnboxedInput<TFacs, TNewFacsUnboxedInput>
    //     >;
    //   };
    // }

    export class Begun {
      add: DiBag.Tmpl.Begun.DotAddProvider = null as any;
      deps: DiBag.Tmpl.Begun.DotDepsProvider = null as any;
    }

    export namespace Begun {
      export type DotAddProvider = {
        types: <
          TNewTypesUnboxedInput extends DiBag.TypesUnboxedInputType,
        >() => DiBag.Tmpl.Interim<
          {},
          DiBag.TypesFromTypesUnboxedInput<{}, TNewTypesUnboxedInput>,
          {}
        >;
        bag: <
          FacsContainer extends {
            factories: FacsType;
          },
        >(
          c: FacsContainer,
        ) => DiBag.Tmpl.Interim<{}, {}, FacsContainer['factories']>;
        factories: <
          TNewFacsUnboxedInput extends DiBag.FacsUnboxedInputPartialType<
            {},
            {},
            {}
          >,
        >(
          unboxed: TNewFacsUnboxedInput,
        ) => DiBag.Tmpl.Interim<
          {},
          {},
          DiBag.FacsFromFacsUnboxedInput<{}, TNewFacsUnboxedInput>
        >;
      };

      export type DotDepsProvider = {
        // inThisBag: <const TNewDepsInThisBagInput extends DiBag.DepsInThisBagType>(
        //   internalDeps: TNewDepsInThisBagInput,
        // ) => DiBag.Tmpl.Interim<[], TNewDepsInThisBagInput, {}, {}>;
        inThisBag: <
          const TDepsInThisBag extends Record<string, readonly string[]>,
        >(
          internalDeps: TDepsInThisBag,
        ) => DiBag.Tmpl.Interim<TDepsInThisBag, {}, {}>;
      };
    }
  }
}

// type FN<TDepsInThisBag extends Record<string, readonly string[]>> = (arg: {
//   // eslint-disable-next-line @typescript-eslint/ban-ts-comment
//   // @ts-ignore
//   [Token in (({
//     [K in keyof TDepsInThisBag]: TDepsInThisBag[K] extends readonly (infer ITEM)[]
//       ? ITEM
//       : never;
//   })[keyof TDepsInThisBag] | keyof TDepsInThisBag)]: 123
// }) => any

// const f = <const TDepsInThisBag extends Record<string, readonly string[]>>(
//   _t: TDepsInThisBag,
// ): FN<TDepsInThisBag> => {
//   //   {
//   //   [K in keyof T]: T[K] extends readonly (infer ITEM)[] ? ITEM : never;
//   //
//   // }[keyof T] | keyof T
//   //   => {
//   return null as any;
// };

const main = () => {
  // const e = f({
  //   a: ['b', 'c'],
  //   d: ['e', 'f'],
  // })({
  //   a: 123,
  //   b: 123,
  //   c: 123,
  //   d: 123,
  //   e: 123,
  //   f: 123
  // });

  // case: no types, but has deps
  const bag = DiBag.begin()
    .deps.inThisBag({
      b: ['a'],
      c: ['a', 'd'],
    })
    .add.types<{
      e: 555;
      d: 'hoy';
    }>()
    .add.factories({
      a: () => 123,
      b: () => 'ho',
      c: () => 99,
      d: () => 'hoy' as const,
      e: () => 555,
      g: async () => {
        // const x = access.unresolved.callFactory('')
        // const x = await access.toFullyResolvedAccessor().async()
      },
    })
    .add.factories({
      f: () => {
        return 99999 as const;
      },
    })
    .end();

  const bag3 = DiBag.begin()
    .add.factories({
      b3a: () => 999,
      b3b: () => 333 as const,
    })
    .end();

  // const bag2 = DiBag.begin().add.factories({
  //   c: () => 123,
  // }).end();
  const bag2 = DiBag.begin()
    .add.bag(bag)
    .add.bag(bag3)
    .add.factories({
      ccc: () => 123,
    })
    .add.factories({
      aa: (args) => args.values.ccc,
      bb: (args) => args.values.f,
      cc: (args) => args.values.b3b,
      // f: () => 123
    })
    .end();

  return bag2;

  // .add.types<{
  //   b: 'hoh';
  // }>()
  // .add.factories({
  //   // b: () => 'hoh',
  //   // a: () => 'op',
  //   // b: () => 'heh',
  // })
  // .add.factories({})
  // .end();

  // case: types and factories are available
  // const bag = DiBag.begin()
  //   .deps.inThisBag({
  //     b: ['a'],
  //   })
  //   .add.types<{
  //     a: 'type:a';
  //     b: 'type:b';
  //   }>()
  //   .add.factories({
  //     a: () => 'type:a',
  //     b: () => 'type:b',
  //   })
  //   .end();
  // type should fail
  // const bag = DiBag.begin()
  //   .add.types<{
  //     a: { hoh: 2; hey: 1 };
  //     b: 'hey';
  //     d: 'opana';
  //     ff: 'heyhey';
  //     fef: 'all right';
  //   }>()
  //   .add.factories({
  //     a: () => ({ hey: 1, hoh: 2 }),
  //     b: () => 'hey',
  //     c: () => '9999' as const,
  //     d: () => 'opana',
  //     // d: () => 'opana',
  //     // a: () => 'hey',
  //   })
  //   .add.types<{
  //     newone: 'imnew';
  //   }>()
  //   .add.factories({
  //     ff: () => 'heyhey',
  //     fef: () => 'all right',
  //     // d: () => 123,
  //     dd: ({ access }) => {
  //       const x = access.resolved.boxes.d.getValue();
  //     },
  //   })
  //   .add.factories({
  //     newone: () => 'imnew',
  //   })
  //   .end();
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

// TODO next: 1. Work on deps plugin as in final-design-2.md. // Don't do this just yet
// TODO next: 2. Implement .injections as in final-design.md. // Rename it to .add.values, but this is the same as having a factory
// TODO next: 3. Implement withTypeProvider as in final-design-2.md. // Already did it

// TODO 2: 0. Add .end method ; // DONE???
// TODO 2: 0.1. Finalize `access` design // Current design is fine, needs more attention when working on the runtime
// TODO 2: 1. Finalize TypeScript for .add.type and .add.factories ; // IT WORKS???

// --- vvvv ---

// TODO 2: 2. TypeScript for .deps ; // implement ofThisBag
// TODO 2: 3. Start adding runtime ; // !!!

// TODO next: 999. Add event emitter

main();
