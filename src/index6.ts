export type DiBagBeginOpts = {
  alias?: string;
};

export class DiBagTemplate_WithFactories<
  F extends Record<string, (input: any) => any>,
> {
  _alias: string;
  _factories: {
    [K in keyof F]: (input: { self: F }) => ReturnType<F[K]>;
  };

  constructor(
    alias: string,
    factories: {
      [K in keyof F]: (input: { self: F }) => ReturnType<F[K]>;
    },
  ) {
    this._alias = alias;
    this._factories = factories;
  }

  end(): DiBag<F> {
    return new DiBag<F>(this._alias, this._factories);
  }
}

export class DiBagTemplate_Begin {
  _alias: string;

  constructor(alias: string) {
    this._alias = alias;
  }

  factories<F extends Record<string, (input: any) => any>>(factories: {
    [K in keyof F]: (input: {
      self: unknown;
      cache: unknown;
    }) => ReturnType<F[K]>;
  }) {
    return new DiBagTemplate_WithFactories<F>(this._alias, factories);
  }
}

export class DiBag<F extends Record<string, (input: any) => any>> {
  _alias: string;
  _factories: {
    [K in keyof F]: (input: { self: F }) => ReturnType<F[K]>;
  };

  static begin(beginOpts?: DiBagBeginOpts): DiBagTemplate_Begin {
    return new DiBagTemplate_Begin(beginOpts?.alias ?? '<<Anonymous DiBag>>');
  }

  constructor(
    alias: string,
    factories: {
      [K in keyof F]: (input: { self: F }) => ReturnType<F[K]>;
    },
  ) {
    this._alias = alias;
    this._factories = factories;
  }
}

const test = () => {
  const bag = DiBag.begin({
    alias: 'Hey',
  })
    .factories({
      a: () => 123,
    })
    .end();

  console.log(bag._alias);
};

test();
