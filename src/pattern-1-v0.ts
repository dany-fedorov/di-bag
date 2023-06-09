import type { ValBox } from 'val-box';
import type { SasBox } from 'sas-box';

type FArgs<
  FF extends Record<
    string,
    (args: FArgs<any>) => SasBox.Unknown<ValBox.Unknown<any, any>>
  >,
> = {
  token: string;
  factories: FF;
  // cache: { [K in keyof T]: () => SasBox<ValBox<T[K], any>> };
  cache: {
    callFactory<K extends keyof FF>(token: K): ReturnType<FF[K]>;
    resolveSync<K extends keyof FF>(
      token: K,
    ): ReturnType<FF[K]> extends SasBox.Sync<any>
      ? ReturnType<
          ReturnType<Exclude<ReturnType<FF[K]>['sync'], undefined>>['getValue']
        >
      : never;
    resolve<K extends keyof FF>(
      token: K,
    ): Promise<
      ReturnType<Awaited<ReturnType<ReturnType<FF[K]>['async']>>['getValue']>
    >;
  };
};

// type DiBagT_WithFacs<FF extends Record<string, SasBox<ValBox<any, any>>>> =
//   {
//     end: () => DiBag<FF>;
//   };

// type DiBagT_Begin_Facs = {
//   <F extends Record<string, (args: FArgs<Record<string, any>>) => any>>(
//     f: F,
//   ): DiBagT_WithFacs<{ [K in keyof F]: SasBox<ValBox<F[K], any>> }>;
// };
//
// type DiBagT_Begin = {
//   factories: DiBagT_Begin_Facs;
// };

class DiBagBase<
  FF extends Record<
    string,
    (args: FArgs<any>) => SasBox.Unknown<ValBox.Unknown<any, any>>
  >,
> {
  constructor(public readonly ff: FF) {}

  callFactory<K extends keyof FF>(token: K): ReturnType<FF[K]> {
    return {} as any;
  }

  resolveSync<K extends keyof FF>(
    token: K,
  ): ReturnType<
    ReturnType<Exclude<ReturnType<FF[K]>['sync'], undefined>>['getValue']
  > {
    // > //   undefined //   ReturnType<Exclude<ReturnType<FF[K]>['sync'], null>['getValue']>, //   Exclude<
    const v = this.ff[token]?.({} as any)
      .assertHasSync()
      .sync()
      .assertHasValue()
      .getValue();
    // ({} as any).sync!().getValue();
    // return {} as any;
    return v;
  }

  async resolve<K extends keyof FF>(
    token: K,
  ): Promise<
    ReturnType<ReturnType<Exclude<ReturnType<FF[K]>['sync'], undefined>>['getValue']>
  > {
    const rv = await this.ff[token]?.({} as any).resolveSyncFirst();
    if (rv === undefined) {
      throw new Error('resolve: undefined');
    }
    const v = rv.assertHasValue().getValue();
    // const v = (await (this.ff[token]?.({} as any).resolveSyncFirst()))
    //   .assertHasValue()
    //   .getValue();
    return v;
  }
}

class DiBagTmpl_WithFacs<
  PREV_FF extends Record<
    string,
    (
      args: FArgs<Record<string, any>>,
    ) => SasBox.Unknown<ValBox.Unknown<any, any>>
  >,
  FF extends Record<
    string,
    (args: FArgs<PREV_FF>) => SasBox.Unknown<ValBox.Unknown<any, any>>
  >,
> extends DiBagBase<FF> {
  constructor(ff: FF) {
    super(ff);
  }

  /**
   * TODO: CONTINUE HERE: Make sure you can add factories merging all types
   */
  registerFacs = createFacsMethodObject_forWithFacs<
    PREV_FF,
    FF
  >();

  end(): DiBag<FF> {
    return new DiBag<FF>(this.ff);
  }
}

/**
 * TODO: CONTINUE HERE: Try to make so that not-undefined values in unboxed.sync (default) are wrapped in ValBoxV
 */
type DiBagTmpl_Begin_Facs = {
  <F extends Record<string, (args: FArgs<Record<string, any>>) => any>>(
    f: F | ((args: { bag: DiBagTmpl_Begin }) => F),
  ): DiBagTmpl_WithFacs<
    // eslint-disable-next-line @typescript-eslint/ban-types
    {},
    {
      [K in keyof F]: (
        args: FArgs<Record<string, any>>,
      ) => ReturnType<F[K]> extends Promise<infer PromisedType>
        ? PromisedType extends undefined
          ? SasBox.Unknown<ValBox.NoValue.NoMetadata>
          : SasBox.Unknown<ValBox.WithValue.NoMetadata<PromisedType>>
        : ReturnType<F[K]> extends undefined
        ? SasBox.Sync<ValBox.NoValue.NoMetadata>
        : SasBox.Sync<ValBox.WithValue.NoMetadata<ReturnType<F[K]>>>;
    }
  >;
  /**
   * TODO: CONTINUE HERE: Add rest
   */
  boxed: any;
  unboxed: any;
  sync: any;
  async: any;
};

function createFacsMethodObject_forBegin(): DiBagTmpl_Begin_Facs {
  // function DiBagTmpl_Begin_Facs_Fn() {}
  return {} as any;
}

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

export type DiBagTmpl_WithFacs_Facs<
  PREV_PREV_FF extends Record<
    string,
    (args: FArgs<any>) => SasBox.Unknown<ValBox.Unknown<any, any>>
  >,
  PREV_FF extends Record<
    string,
    (args: FArgs<PREV_PREV_FF>) => SasBox.Unknown<ValBox.Unknown<any, any>>
  >,
> = {
  <F extends Record<string, (args: FArgs<PREV_FF>) => any>>(
    // eslint-disable-next-line @typescript-eslint/ban-types
    f:
      | F
      | ((args: { bag: DiBagTmpl_WithFacs<PREV_PREV_FF, PREV_FF> }) => F),
  ): DiBagTmpl_WithFacs<
    Prettify<Assign<PREV_PREV_FF, PREV_FF>>,
    Prettify<
      Assign<
        PREV_FF,
        {
          [K in keyof F]: (
            args: FArgs<PREV_FF>,
          ) => ReturnType<F[K]> extends Promise<infer PromisedType>
            ? PromisedType extends undefined
              ? SasBox.Unknown<ValBox.NoValue.NoMetadata>
              : SasBox.Unknown<ValBox.WithValue.NoMetadata<PromisedType>>
            : ReturnType<F[K]> extends undefined
            ? SasBox.Sync<ValBox.NoValue.NoMetadata>
            : SasBox.Sync<ValBox.WithValue.NoMetadata<ReturnType<F[K]>>>;
        }
      >
    >
  >;
  /**
   * TODO: CONTINUE HERE: Add rest
   */
  boxed: any;
  unboxed: any;
  sync: any;
  async: any;
};

function createFacsMethodObject_forWithFacs<
  PREV_PREV_FF extends Record<
    string,
    (
      args: FArgs<Record<string, any>>,
    ) => SasBox.Unknown<ValBox.Unknown<any, any>>
  >,
  PREV_FF extends Record<
    string,
    (args: FArgs<PREV_PREV_FF>) => SasBox.Unknown<ValBox.Unknown<any, any>>
  >,
>(): DiBagTmpl_WithFacs_Facs<PREV_PREV_FF, PREV_FF> {
  // function DiBagTmpl_Begin_Facs_Fn() {}
  return {} as any;
}

class DiBagTmpl_Begin extends DiBagBase<{}> {
  registerFacs: DiBagTmpl_Begin_Facs =
    createFacsMethodObject_forBegin();
}

class DiBag<
  FF extends Record<
    string,
    (args: FArgs<any>) => SasBox.Unknown<ValBox.Unknown<any, any>>
  >,
> extends DiBagBase<FF> {
  constructor(ff: FF) {
    super(ff);
  }

  static begin(): DiBagTmpl_Begin {
    return new DiBagTmpl_Begin({});
    /*return {
      factories: (f) => {
        const ff: any = {};
        return {
          end: () => {
            return new DiBag(ff);
          },
        };
      },
    };*/
  }
}

const dibag = DiBag.begin()
  .registerFacs(() => ({
    a: () => 1235 as const,
    b: (args) => {
      // const v = args.cache.getValueSync('a');
      // return v;
      return args.factories['a']?.({ ...args, token: 'a' })
        .assertHasSync()
        .sync()
        .assertHasValue()
        .getValue() as 123;
    },
    c: (args) =>
      args.cache
        .callFactory('b')
        .assertHasSync()
        .sync()
        .assertHasValue()
        .getValue() as 123,
    d: ({ cache }) => cache.resolveSync('c') as 321,
    e: () => undefined,
  }))
  .registerFacs(({ bag }) => ({
    f: () => 123 as const,
    g: (args) =>
      args.factories['a']?.({ ...args, token: 'a' })
        .assertHasSync()
        .sync()
        .assertHasValue()
        .getValue(),
    h: async () => await bag.resolve('d'),
  }))
  .end();

const main = async () => {
  const b1 = dibag.callFactory('b').sync().getValue();
  const d1 = dibag.callFactory('e').sync().hasValue();
  const c1 = dibag.resolveSync('d');
  const f1 = dibag.resolveSync('f');
  const g1 = dibag.resolveSync('g');
  const h1 = dibag.resolveSync('h');
  // const bb = dibag.getValueSync('b');
  // const b1 = bb.assertHasSync().sync().assertHasValue().getValue();
  // const b2 = dibag.resolveSync('b');
  // const c = await dibag.resolve('c');
};

main();
