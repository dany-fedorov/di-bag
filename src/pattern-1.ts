import type { ValBox } from 'val-box';
import type { SasBox, SasBoxSync } from 'sas-box';

type FArgs<T extends Record<string, any>> = {
  token: string;
  self: {
    [K in keyof T]: (args: FArgs<T>) => SasBox.Async<ValBox.Unknown<T[K], any>>;
  };
  // cache: { [K in keyof T]: () => SasBox<ValBox<T[K], any>> };
  cache: {
    callTokenMethod<K extends keyof T>(
      token: K,
    ): SasBox.Async<ValBox.Unknown<T[K], any>>;
    resolveSync<K extends keyof T>(token: K): T[K];
    resolve<K extends keyof T>(token: K): Promise<T[K]>;
  };
};

// type DiBagT_WithFactories<FF extends Record<string, SasBox<ValBox<any, any>>>> =
//   {
//     end: () => DiBag<FF>;
//   };

// type DiBagT_Begin_Factories = {
//   <F extends Record<string, (args: FArgs<Record<string, any>>) => any>>(
//     f: F,
//   ): DiBagT_WithFactories<{ [K in keyof F]: SasBox<ValBox<F[K], any>> }>;
// };
//
// type DiBagT_Begin = {
//   factories: DiBagT_Begin_Factories;
// };

class DiBagTmpl_WithFactories<
  FF extends Record<
    string,
    (args: FArgs<Record<string, any>>) => SasBox.Async<ValBox.Unknown<any, any>>
  >,
> {
  constructor(private readonly ff: FF) {}

  /**
   * TODO: CONTINUE HERE: Make sure you can add factories merging all types
   */
  factories: any;

  end(): DiBag<FF> {
    return new DiBag<FF>(this.ff);
  }
}

/**
 * TODO: CONTINUE HERE: Try to make so that not-undefined values in unboxed.sync (default) are wrapped in ValBoxV
 */
type DiBagTmpl_Begin_Factories = {
  <F extends Record<string, (args: FArgs<Record<string, any>>) => any>>(
    f: F,
  ): DiBagTmpl_WithFactories<{
    [K in keyof F]: (
      args: FArgs<Record<string, any>>,
    ) => ReturnType<F[K]> extends undefined
      ? SasBoxSync<ValBox.NoValue.NoMetadata>
      : SasBoxSync<ValBox.WithValue.NoMetadata<ReturnType<F[K]>>>;
  }>;
  /**
   * TODO: CONTINUE HERE: Add rest
   */
  boxed: any;
  unboxed: any;
  sync: any;
  async: any;
};

function createFactoriesMethodObject(): DiBagTmpl_Begin_Factories {
  // function DiBagTmpl_Begin_Factories_Fn() {}
  return {} as any;
}

class DiBagTmpl_Begin {
  factories: DiBagTmpl_Begin_Factories = createFactoriesMethodObject();
}

class DiBag<
  FF extends Record<
    string,
    (args: FArgs<Record<string, any>>) => SasBox.Async<ValBox.Unknown<any, any>>
  >,
> {
  constructor(private readonly ff: FF) {}

  getValueSync<K extends keyof FF>(token: K): ReturnType<FF[K]> {
    return {} as any;
  }

  resolveSync<K extends keyof FF>(
    token: K,
  ): ReturnType<
    ReturnType<Exclude<ReturnType<FF[K]>['sync'], null>>['getValue']
  > //   undefined //   ReturnType<Exclude<ReturnType<FF[K]>['sync'], null>['getValue']>, //   Exclude<
  // >
  {
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
    ReturnType<ReturnType<Exclude<ReturnType<FF[K]>['sync'], null>>['getValue']>
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

  static begin(): DiBagTmpl_Begin {
    return new DiBagTmpl_Begin();
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
  .factories({
    a: () => 123,
    b: (args) => {
      // const v = args.cache.getValueSync('a');
      // return v;
      return args.self['a']?.({ ...args, token: 'a' })
        .assertHasSync()
        .sync()
        .assertHasValue()
        .getValue() as 123;
    },
    c: (args) =>
      args.cache
        .callTokenMethod('b')
        .assertHasSync()
        .sync()
        .assertHasValue()
        .getValue() as 123,
    d: ({ cache }) => cache.resolveSync('c'),
    e: () => undefined,
  })
  .end();

const main = async () => {
  const b1 = dibag.getValueSync('b').sync().getValue();
  const d1 = dibag.getValueSync('e').sync().hasValue();
  // const bb = dibag.getValueSync('b');
  // const b1 = bb.assertHasSync().sync().assertHasValue().getValue();
  // const b2 = dibag.resolveSync('b');
  // const c = await dibag.resolve('c');
};

main();
