import type { ValBox } from 'val-box';
import type { SasBox } from 'sas-box';

type FArgs_Cache<
  FF_SYNC extends Record<
    string,
    (args: FArgs<any, any>) => SasBox.Sync<ValBox.Unknown<any, any>>
  >,
  FF_ASYNC extends Record<
    string,
    (args: FArgs<any, any>) => SasBox.Unknown<ValBox.Unknown<any, any>>
  >,
> = {
  callFactory<K extends keyof FF_SYNC | keyof FF_ASYNC>(
    token: K,
  ): K extends keyof FF_SYNC
    ? ReturnType<FF_SYNC[K]>
    : K extends keyof FF_ASYNC
    ? ReturnType<FF_ASYNC[K]>
    : never;
  resolveSync<K extends keyof FF_SYNC>(
    token: K,
  ): ReturnType<
    ReturnType<Exclude<ReturnType<FF_SYNC[K]>['sync'], undefined>>['getValue']
  >;

  resolve<K extends keyof FF_SYNC | keyof FF_ASYNC>(
    token: K,
  ): Promise<
    K extends keyof FF_SYNC
      ? ReturnType<
          Awaited<ReturnType<ReturnType<FF_SYNC[K]>['async']>>['getValue']
        >
      : K extends keyof FF_ASYNC
      ? ReturnType<
          Awaited<ReturnType<ReturnType<FF_ASYNC[K]>['async']>>['getValue']
        >
      : never
  >;
};

type FArgs_Begin = {
  token: string;
  sync_factories: Record<string, unknown>;
  async_factories: Record<string, unknown>;
  getFactory: (
    token: string,
  ) =>
    | undefined
    | ((
        args: FArgs<any, any>,
      ) => SasBox.Sync<ValBox.Unknown<unknown, unknown>>);
  // cache: { [K in keyof T]: () => SasBox<ValBox<T[K], any>> };
  // cache: FArgs_Cache<
  //   Record<
  //     string,
  //     (args: FArgs<any, any>) => SasBox.Sync<ValBox.Unknown<any, any>>
  //   >,
  //   Record<
  //     string,
  //     (args: FArgs<any, any>) => SasBox.Unknown<ValBox.Unknown<any, any>>
  //   >
  // >;
  cache: {
    callFactory(token: string): SasBox.Sync<ValBox.Unknown<unknown, unknown>>;
    resolveSync(token: string): unknown;
    resolve(token: string): Promise<unknown>;
  };
};

type FArgs<
  FF_SYNC extends Record<
    string,
    (args: FArgs<any, any>) => SasBox.Sync<ValBox.Unknown<any, any>>
  >,
  FF_ASYNC extends Record<
    string,
    (args: FArgs<any, any>) => SasBox.Unknown<ValBox.Unknown<any, any>>
  >,
> = {
  token: string;
  sync_factories: FF_SYNC;
  async_factories: FF_ASYNC;
  getFactory: <K extends keyof FF_SYNC | keyof FF_ASYNC>(
    token: K,
  ) => K extends keyof FF_SYNC
    ? FF_SYNC[K]
    : K extends keyof FF_ASYNC
    ? FF_ASYNC[K]
    : never;
  // cache: { [K in keyof T]: () => SasBox<ValBox<T[K], any>> };
  cache: FArgs_Cache<FF_SYNC, FF_ASYNC>;
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
  PREV_FF_SYNC extends Record<
    string,
    (
      args: FArgs<Record<string, any>, Record<string, any>>,
    ) => SasBox.Sync<ValBox.Unknown<any, any>>
  >,
  PREV_FF_ASYNC extends Record<
    string,
    (
      args: FArgs<Record<string, any>, Record<string, any>>,
    ) => SasBox.Unknown<ValBox.Unknown<any, any>>
  >,
  FF_SYNC extends Record<
    string,
    (args: FArgs<any, any>) => SasBox.Sync<ValBox.Unknown<any, any>>
  >,
  FF_ASYNC extends Record<
    string,
    (args: FArgs<any, any>) => SasBox.Unknown<ValBox.Unknown<any, any>>
  >,
> {
  constructor(
    public readonly ff_sync: FF_SYNC,
    public readonly ff_async: FF_ASYNC,
  ) {}

  callFactory<
    K extends
      | keyof PREV_FF_SYNC
      | keyof PREV_FF_ASYNC
      | keyof FF_SYNC
      | keyof FF_ASYNC,
  >(
    _token: K,
  ): K extends keyof FF_SYNC
    ? ReturnType<FF_SYNC[K]>
    : K extends keyof PREV_FF_SYNC
    ? ReturnType<PREV_FF_SYNC[K]>
    : K extends keyof PREV_FF_ASYNC
    ? ReturnType<PREV_FF_ASYNC[K]>
    : K extends keyof FF_ASYNC
    ? ReturnType<FF_ASYNC[K]>
    : never {
    return {} as any;
  }

  resolveSync<K extends keyof PREV_FF_SYNC | keyof FF_SYNC>(
    token: K,
  ): K extends keyof FF_SYNC
    ? ReturnType<
        ReturnType<
          Exclude<ReturnType<FF_SYNC[K]>['sync'], undefined>
        >['getValue']
      >
    : K extends keyof PREV_FF_SYNC
    ? ReturnType<
        ReturnType<
          Exclude<ReturnType<PREV_FF_SYNC[K]>['sync'], undefined>
        >['getValue']
      >
    : never {
    // > //   undefined //   ReturnType<Exclude<ReturnType<FF[K]>['sync'], null>['getValue']>, //   Exclude<
    const v = this.ff_sync[token]?.({} as any)
      .assertHasSync()
      .sync()
      .assertHasValue()
      .getValue();
    // ({} as any).sync!().getValue();
    // return {} as any;
    return v;
  }

  async resolve<
    K extends
      | keyof PREV_FF_SYNC
      | keyof PREV_FF_ASYNC
      | keyof FF_SYNC
      | keyof FF_ASYNC,
  >(
    token: K,
  ): Promise<
    K extends keyof PREV_FF_SYNC
      ? ReturnType<
          ReturnType<
            Exclude<ReturnType<PREV_FF_SYNC[K]>['sync'], undefined>
          >['getValue']
        >
      : K extends keyof FF_SYNC
      ? ReturnType<
          ReturnType<
            Exclude<ReturnType<FF_SYNC[K]>['sync'], undefined>
          >['getValue']
        >
      : K extends keyof FF_ASYNC
      ? ReturnType<
          Awaited<ReturnType<ReturnType<FF_ASYNC[K]>['async']>>['getValue']
        >
      : K extends keyof PREV_FF_ASYNC
      ? ReturnType<
          Awaited<ReturnType<ReturnType<PREV_FF_ASYNC[K]>['async']>>['getValue']
        >
      : never
  > {
    let rv;
    if (token in this.ff_sync) {
      rv = await this.ff_sync[token]?.({} as any).resolveSyncFirst();
    } else {
      rv = await this.ff_async[token]?.({} as any).resolveSyncFirst();
    }
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
  PREV_FF_SYNC extends Record<
    string,
    (
      args: FArgs<Record<string, any>, Record<string, any>>,
    ) => SasBox.Sync<ValBox.Unknown<any, any>>
  >,
  PREV_FF_ASYNC extends Record<
    string,
    (
      args: FArgs<Record<string, any>, Record<string, any>>,
    ) => SasBox.Unknown<ValBox.Unknown<any, any>>
  >,
  FF_SYNC extends Record<
    string,
    (
      args: FArgs<PREV_FF_SYNC, PREV_FF_ASYNC>,
    ) => SasBox.Sync<ValBox.Unknown<any, any>>
  >,
  FF_ASYNC extends Record<
    string,
    (
      args: FArgs<PREV_FF_SYNC, PREV_FF_ASYNC>,
    ) => SasBox.Unknown<ValBox.Unknown<any, any>>
  >,
> extends DiBagBase<PREV_FF_SYNC, PREV_FF_ASYNC, FF_SYNC, FF_ASYNC> {
  constructor(ff_sync: FF_SYNC, ff_async: FF_ASYNC) {
    super(ff_sync, ff_async);
  }

  /**
   * TODO: CONTINUE HERE: Make sure you can add factories merging all types
   */
  register = createFacsMethodObject_forWithFacs<
    PREV_FF_SYNC,
    PREV_FF_ASYNC,
    FF_SYNC,
    FF_ASYNC
  >();

  end(): DiBag<PREV_FF_SYNC, PREV_FF_ASYNC, FF_SYNC, FF_ASYNC> {
    return new DiBag<PREV_FF_SYNC, PREV_FF_ASYNC, FF_SYNC, FF_ASYNC>(
      this.ff_sync,
      this.ff_async,
    );
  }
}

/**
 * TODO: CONTINUE HERE: Try to make so that not-undefined values in unboxed.sync (default) are wrapped in ValBoxV
 */
type DiBagTmpl_Begin_Facs = {
  <F extends Record<string, (args: FArgs_Begin) => any>>(
    f: F | ((args: { bag: DiBagTmpl_Begin }) => F),
  ): DiBagTmpl_WithFacs<
    // eslint-disable-next-line @typescript-eslint/ban-types
    {},
    // eslint-disable-next-line @typescript-eslint/ban-types
    {},
    // vvv SYNC vvv
    {
      [K in keyof F as ReturnType<F[K]> extends Promise<any>
        ? never
        : K]: ReturnType<F[K]> extends undefined
        ? // eslint-disable-next-line @typescript-eslint/ban-types
          (args: FArgs<{}, {}>) => SasBox.Sync<ValBox.NoValue.NoMetadata>
        : (
            // eslint-disable-next-line @typescript-eslint/ban-types
            args: FArgs<{}, {}>,
          ) => SasBox.Sync<ValBox.WithValue.NoMetadata<ReturnType<F[K]>>>;
    },
    // ^^^ SYNC ^^^
    // vvv ASYNC vvv
    {
      [K in keyof F as ReturnType<F[K]> extends Promise<any>
        ? K
        : never]: ReturnType<F[K]> extends Promise<infer PromisedType>
        ? PromisedType extends undefined
          ? (
              args: FArgs<{ [k in string]: any }, { [k in string]: any }>,
            ) => SasBox.Async<ValBox.NoValue.NoMetadata>
          : (
              args: FArgs<{ [k in string]: any }, { [k in string]: any }>,
            ) => SasBox.Async<ValBox.WithValue.NoMetadata<PromisedType>>
        : never;
    }
    // ^^^ ASYNC ^^^
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
  PREV_PREV_FF_SYNC extends Record<
    string,
    (args: FArgs<any, any>) => SasBox.Sync<ValBox.Unknown<any, any>>
  >,
  PREV_PREV_FF_ASYNC extends Record<
    string,
    (args: FArgs<any, any>) => SasBox.Unknown<ValBox.Unknown<any, any>>
  >,
  PREV_FF_SYNC extends Record<
    string,
    (
      args: FArgs<PREV_PREV_FF_SYNC, PREV_PREV_FF_ASYNC>,
    ) => SasBox.Sync<ValBox.Unknown<any, any>>
  >,
  PREV_FF_ASYNC extends Record<
    string,
    (
      args: FArgs<PREV_PREV_FF_SYNC, PREV_PREV_FF_ASYNC>,
    ) => SasBox.Unknown<ValBox.Unknown<any, any>>
  >,
> = {
  <
    F extends Record<
      string,
      (
        args: FArgs<
          Prettify<Assign<PREV_PREV_FF_SYNC, PREV_FF_SYNC>>,
          Prettify<Assign<PREV_PREV_FF_ASYNC, PREV_FF_ASYNC>>
        >,
      ) => any
    >,
  >(
    // eslint-disable-next-line @typescript-eslint/ban-types
    f:
      | F
      | ((args: {
          bag: DiBagTmpl_WithFacs<
            PREV_PREV_FF_SYNC,
            PREV_PREV_FF_ASYNC,
            PREV_FF_SYNC,
            PREV_FF_ASYNC
          >;
        }) => F),
  ): DiBagTmpl_WithFacs<
    Prettify<Assign<PREV_PREV_FF_SYNC, PREV_FF_SYNC>>,
    Prettify<Assign<PREV_PREV_FF_ASYNC, PREV_FF_ASYNC>>,
    // vvv SYNC vvv
    {
      [K in keyof F as ReturnType<F[K]> extends Promise<any>
        ? never
        : K]: ReturnType<F[K]> extends undefined
        ? (
            args: FArgs<
              Prettify<Assign<PREV_PREV_FF_SYNC, PREV_FF_SYNC>>,
              Prettify<Assign<PREV_PREV_FF_ASYNC, PREV_FF_ASYNC>>
            >,
          ) => SasBox.Sync<ValBox.NoValue.NoMetadata>
        : (
            args: FArgs<
              Prettify<Assign<PREV_PREV_FF_SYNC, PREV_FF_SYNC>>,
              Prettify<Assign<PREV_PREV_FF_ASYNC, PREV_FF_ASYNC>>
            >,
          ) => SasBox.Sync<ValBox.WithValue.NoMetadata<ReturnType<F[K]>>>;
    },
    // ^^^ SYNC ^^^
    // vvv ASYNC vvv
    {
      [K in keyof F as ReturnType<F[K]> extends Promise<infer _PromisedType>
        ? K
        : never]: ReturnType<F[K]> extends Promise<infer PromisedType>
        ? PromisedType extends undefined
          ? (
              args: FArgs<
                Prettify<Assign<PREV_PREV_FF_SYNC, PREV_FF_SYNC>>,
                Prettify<Assign<PREV_PREV_FF_ASYNC, PREV_FF_ASYNC>>
              >,
            ) => SasBox.Async<ValBox.NoValue.NoMetadata>
          : (
              args: FArgs<
                Prettify<Assign<PREV_PREV_FF_SYNC, PREV_FF_SYNC>>,
                Prettify<Assign<PREV_PREV_FF_ASYNC, PREV_FF_ASYNC>>
              >,
            ) => SasBox.Async<ValBox.WithValue.NoMetadata<PromisedType>>
        : never;
    }
    // ^^^ ASYNC ^^^
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
  PREV_PREV_FF_SYNC extends Record<
    string,
    (
      args: FArgs<Record<string, any>, Record<string, any>>,
    ) => SasBox.Sync<ValBox.Unknown<any, any>>
  >,
  PREV_PREV_FF_ASYNC extends Record<
    string,
    (
      args: FArgs<Record<string, any>, Record<string, any>>,
    ) => SasBox.Unknown<ValBox.Unknown<any, any>>
  >,
  PREV_FF_SYNC extends Record<
    string,
    (
      args: FArgs<PREV_PREV_FF_SYNC, PREV_PREV_FF_ASYNC>,
    ) => SasBox.Sync<ValBox.Unknown<any, any>>
  >,
  PREV_FF_ASYNC extends Record<
    string,
    (
      args: FArgs<PREV_PREV_FF_SYNC, PREV_PREV_FF_ASYNC>,
    ) => SasBox.Unknown<ValBox.Unknown<any, any>>
  >,
>(): DiBagTmpl_WithFacs_Facs<
  PREV_PREV_FF_SYNC,
  PREV_PREV_FF_ASYNC,
  PREV_FF_SYNC,
  PREV_FF_ASYNC
> {
  // function DiBagTmpl_Begin_Facs_Fn() {}
  return {} as any;
}

// eslint-disable-next-line @typescript-eslint/ban-types
class DiBagTmpl_Begin extends DiBagBase<{}, {}, {}, {}> {
  register: DiBagTmpl_Begin_Facs = createFacsMethodObject_forBegin();
}

class DiBag<
  PREV_FF_SYNC extends Record<
    string,
    (
      args: FArgs<Record<string, any>, Record<string, any>>,
    ) => SasBox.Sync<ValBox.Unknown<any, any>>
  >,
  PREV_FF_ASYNC extends Record<
    string,
    (
      args: FArgs<Record<string, any>, Record<string, any>>,
    ) => SasBox.Unknown<ValBox.Unknown<any, any>>
  >,
  FF_SYNC extends Record<
    string,
    (args: FArgs<any, any>) => SasBox.Sync<ValBox.Unknown<any, any>>
  >,
  FF_ASYNC extends Record<
    string,
    (args: FArgs<any, any>) => SasBox.Unknown<ValBox.Unknown<any, any>>
  >,
> extends DiBagBase<PREV_FF_SYNC, PREV_FF_ASYNC, FF_SYNC, FF_ASYNC> {
  constructor(ff_sync: FF_SYNC, ff_async: FF_ASYNC) {
    super(ff_sync, ff_async);
  }

  static begin(): DiBagTmpl_Begin {
    return new DiBagTmpl_Begin({}, {});
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
  .register(() => ({
    a: () => 1235 as const,
    b: (args) => {
      // const v = args.cache.getValueSync('a');
      const a_fn = args.sync_factories['a'];
      if (typeof a_fn !== 'function') {
        return 999 as const;
      }
      // return v;
      return a_fn({ ...args, token: 'a' })
        .assertHasSync()
        .sync()
        .assertHasValue()
        .getValue() as 123;
    },
    bb: (args) => {
      // const v = args.cache.getValueSync('a');
      // return v;
      // const v = args.factory('a');
      const fac = args.factory('a');
      if (typeof fac !== 'function') {
        return 9992;
      }
      return fac({ ...(args as any), token: 'a' })
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
        .getValue() as 12333,
    d: ({ cache }) => cache.resolveSync('c') as 321,
    e: () => undefined,
  }))
  .register(({ bag }) => ({
    f: () => 123 as const,
    g: (args) => {
      return args.sync_factories['a']?.({ ...args, token: 'a' })
        .assertHasSync()
        .sync()
        .assertHasValue()
        .getValue();
    },
    gg: (args) => {
      return args
        .getFactory('a')({ ...args, token: 'a' })
        .assertHasSync()
        .sync()
        .assertHasValue()
        .getValue();
    },
    h: async () => await bag.resolve('d'),
  }))
  .end();

const dibag2 = DiBag.begin()
  .register({
    prom: async () => 112233 as const,
    a12: () => 'a12' as const,
  })
  .register({
    gdf: async (args) => {
      const f = args.getFactory('prom');
    },
    heh: async (args) =>
      (
        await args
          .getFactory('prom')({
            ...args,
            token: 'heh',
          })
          .async()
      ).getValue(),
  })
  .register({
    hoh: async (args) => (await args.cache.resolve('prom')) + (123 as const),
    hoh2: async (args) => args.cache.resolve('heh'),
    e: (args) => args.cache.resolveSync('a12'),
  })
  .register(() => ({
    ee: ({ cache }) => cache.resolveSync('a12'),
  }))
  .end();

const main = async () => {
  const v1 = await dibag2.resolve('prom');
  const v2 = await dibag2.resolve('hoh');
  const v3 = await dibag2.resolve('hoh2');
  const v4 = dibag2.resolveSync('e');
  const v5 = dibag2.resolveSync('ee');

  const b1 = dibag.callFactory('b').sync().getValue();
  const b2 = dibag.callFactory('bb').sync().getValue();
  const d1 = dibag.callFactory('e').sync().hasValue();
  const d1 = dibag.resolveSync('d');
  const f1 = dibag.resolveSync('f');
  const g1 = dibag.resolveSync('g');
  const g2 = dibag.resolve('g');
  const h1 = dibag.resolveSync('h');
  const h2 = dibag.resolve('h');
  const g2 = dibag.resolveSync('gg');
  // const bb = dibag.getValueSync('b');
  // const b1 = bb.assertHasSync().sync().assertHasValue().getValue();
  // const b2 = dibag.resolveSync('b');
  // const c = await dibag.resolve('c');
};

main();
