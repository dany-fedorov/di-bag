import type { SasBox } from 'sas-box';
import type { ValBox } from 'val-box';

export class DiBagTemplate_WithFacs {}

export type FResultProviderType = {
  readonly input: unknown;
  readonly output: unknown;
  readonly outputMetadata: unknown;
};

export class DiBagTemplate_1<
  FArgsProvider extends Record<string, any>,
  FResultProvider extends FResultProviderType,
  FTypeProvider extends Record<string, any>,
> {
  private f: FTypeProvider = {};

  constructor(
    private readonly argsProducers: {
      [K in keyof FArgsProvider]: (ctx: any) => FArgsProvider[K];
    },
    private readonly resultWrapper: (
      r: FResultProvider['input'],
    ) => SasBox<
      ValBox<FResultProviderType['output'], FResultProvider['outputMetadata']>
    >,
  ) {}

  factories<
    F extends {
      [K in keyof FTypeProvider]: (args: FArgsProvider) => FTypeProvider[K];
    },
  >(newf: F): any {
    // return new DiBagTemplate_1();
  }
}

export class DiBag {
  static begin(): DiBagTemplate_1<
    Record<string, any>,
    { input: SasBox<ValBox<any, any>>; output: any; outputMetadata: any },
    Record<string, any>
  > {
    return new DiBagTemplate_1(
      { self: ({ self }) => self as any },
      (input) => input,
    );
  }
}
