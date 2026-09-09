import type { SasBox } from 'sas-box';
import type { ValBox } from 'val-box';

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace MiniDi {
  export type ContainerProps<Keys extends string> = {
    [key in Keys]: { deps: Keys[]; factory: () => any };
  };

  // export const pprops = <Pps extends Record<string, { factory: () => any }>>(
  //   pps: Pps,
  //   // deps: Record<keyof Pps, (keyof Pps)[]>,
  // ): any => {
  //   return 123;
  // };

  export type ContainerIcfg<Keys extends string> = {
    propFactoryDecorator: (output: any) => SasBox<ValBox<any, any>>;
    propFactoryInjectors: Array<{
      key: string;
      getPmInputObject: (curPmInputObject: object) => object;
    }>;
    props: ContainerProps<Keys>;
  };

  export class Container<Keys extends string> {
    static new<Keys extends string>(icfg: ContainerIcfg<Keys>) {
      new Container(icfg);
    }

    constructor(public readonly icfg: ContainerIcfg<Keys>) {}
  }
}

// MiniDi.pprops({
//   a: {
//     factory: () => {}
//   },
//   b:
// }, {
//
// });
// MiniDi.Container.new();

// function pps<Token extends string>(
//   tokens: Token[],
// ): (props: Record<Token, { deps: Token[]; factory: () => any }>) => any {
//
// }
//
// const deps = {
//   a: {
//     deps: [],
//     factory: () => null,
//   },
//   c: {
//     deps: [],
//     factory: () => null,
//   },
//   b: {
//     deps: ['a', 'c'],
//     factory: () => null,
//   },
// } as const;

// type PP<
//   Deps extends Record<string, { deps: readonly string[]; factory: () => any }>,
// > = {
//   tokens: keyof Deps;
//   types: { [K in keyof Deps]: ReturnType<Deps[K]['factory']> };
// };
//
// function pp<Token extends string, Types extends Record<Token, any>>(deps: {
//   [K in Token]: { deps: readonly Token[]; factory: () => Types[Token] };
// }): any {
//   return 123;
// }
//
// function ppp<Token extends string, Types extends Record<Token, any>>(deps: {
//   [K in Token]: { deps: readonly Token[]; factory: () => Types[Token] };
// }): any {
//   return 123;
// }
//
// type MyPP = PP<typeof deps>;
//
// pp<MyPP['tokens'], MyPP['types']>(deps);

const deps = {
  a: {
    deps: [],
    factory: () => null,
  },
  c: {
    deps: ['a', 'b'],
    factory: () => null,
  },
  b: {
    deps: ['a', 'c'],
    factory: () => null,
  },
} as const;

function withDeps<
  Deps extends Record<string, { deps: readonly string[]; factory: () => any }>,
>(): {
  def: (deps: {
    [K in keyof Deps]: {
      deps: readonly (keyof Deps)[];
      factory: Deps[K]['factory'];
    };
  }) => any;
} {
  return {
    def: () => 123,
  };
}

withDeps<typeof deps>();
withDeps<typeof deps>().def(deps);

function withDeps2<
  Deps extends Record<string, { deps: readonly string[]; factory: () => any }>,
>(deps: {
  [K in keyof Deps]: {
    deps: readonly (keyof Deps)[];
    factory: (bag: { deps: Deps[K]['deps'] }) => ReturnType<Deps[K]['factory']>;
  };
}): {
  addFacs: <>(factories: ) => any;
} {
  return {
    addFacs: () => null,
  };
}

withDeps2<typeof deps>(deps).addFacs({
  a: () => null,
});
