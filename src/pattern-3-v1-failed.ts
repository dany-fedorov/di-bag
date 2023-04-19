export type Expect<T extends true> = T;

export type Equal<X, Y> = (<T>() => T extends X ? 1 : 2) extends <
  T,
>() => T extends Y ? 1 : 2
  ? true
  : false;
export type NotEqual<X, Y> = true extends Equal<X, Y> ? false : true;

type TT = { a: 1 };

type cases = [Expect<Equal<{ a: 1 }, TT>>];

class DiBagFinal<
  TTypes extends Record<string, any>,
  F extends { [K in keyof TTypes]: (x: any) => TTypes[K] },
> {
  constructor(public readonly f: F) {}
}

class DiBag_Begin_WithTypes_WithFacs<
  TTypes extends Record<string, any>,
  F extends Record<string, (x: any) => any>,
> {
  end(): DiBagFinal<TTypes, F> {
    return DiBagFinal<TTypes, F>;
  }
}

class DiBag_Begin_WithTypes<TTYpes extends Record<string, any>> {
  addFacs<F extends Record<string, (args: any) => any>>(
    f: F,
  ): DiBag_Begin_WithTypes_WithFacs<TTypes, F> {}
}

class DiBag_Begin {
  addTypes<
    TTYpes extends Record<string, any>,
  >(): DiBag_Begin_WithTypes<TTypes> {
    return {} as any;
  }
}

class DiBag {
  static begin(): DiBag_Begin {
    return {} as any;
  }
}

const main = () => {};

main();
