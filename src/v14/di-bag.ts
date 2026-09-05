/**
 * di-bag v14 sketch: requirements inferred from factory parameters,
 * shapes checked at every `.add`, totality checked at `.end`, cycles
 * detected at resolve. No `@ts-ignore`, no `any`.
 */

// `never` is the bottom of the parameter position: every function is assignable
// to it, so the constraint accepts any factory and the real parameter type is
// recovered with `Parameters<>` where it is needed.
type Factory = (deps: never) => unknown;
type Factories = Record<string, Factory>;

/** What a factory destructures from its parameter; `{}`-shaped for a factory with none. */
type Needs<F extends Factory> = Parameters<F>[0] extends infer P
  ? [P] extends [object]
    ? P
    : Record<never, never>
  : never;

/** Union of every key any factory needs. */
type RequiredOf<F extends Factories> = { [K in keyof F]: keyof Needs<F[K]> }[keyof F] & string;

/** What each token resolves to. */
type Provided<F extends Factories> = { [K in keyof F]: ReturnType<F[K]> };

declare const brand: unique symbol;
type Unsatisfied<Msg extends string, Props> = { readonly [brand]: Msg } & Props;

/**
 * For every factory, the tokens it needs that the bag already has must have the
 * shape it needs. Tokens not yet added are not judged here; `.end` catches them.
 */
type Checked<F extends Factories> = {
  [K in keyof F]: Pick<Provided<F>, keyof Needs<F[K]> & keyof F> extends Pick<
    Needs<F[K]>,
    keyof Needs<F[K]> & keyof F
  >
    ? F[K]
    : Unsatisfied<'a dependency has the wrong shape', { token: K; needs: Needs<F[K]> }>;
};

type Merge<F extends Factories, N extends Factories> = Omit<F, keyof N> & N;

type EndOf<F extends Factories> = [Exclude<RequiredOf<F>, keyof F>] extends [never]
  ? () => Bag<F>
  : Unsatisfied<'missing factories', { missing: Exclude<RequiredOf<F>, keyof F> }>;

export class Bag<F extends Factories> {
  private readonly memo = new Map<string, unknown>();
  private readonly resolving: string[] = [];

  constructor(readonly factories: F) {}

  resolve<K extends keyof F & string>(token: K): Provided<F>[K] {
    if (this.memo.has(token)) return this.memo.get(token) as Provided<F>[K];
    if (this.resolving.includes(token))
      throw new Error(`cycle: ${[...this.resolving, token].join(' -> ')}`);
    const factory = this.factories[token];
    if (factory === undefined) throw new Error(`no factory for ${token}`);
    this.resolving.push(token);
    try {
      const deps = new Proxy({} as Record<string, unknown>, {
        get: (_, key) => this.resolve(String(key) as K),
      });
      // The proxy resolves each key lazily and is the `never`-typed parameter's
      // only runtime inhabitant; `Checked` has already proved every key it
      // will be asked for resolves to the shape the factory declared.
      const value = factory(deps as never) as Provided<F>[K];
      this.memo.set(token, value);
      return value;
    } finally {
      this.resolving.pop();
    }
  }

  /** Same graph, some tokens replaced: the batch `scope`, or a test fake. Fresh memo. */
  fork<O extends { [K in keyof F]?: F[K] }>(overrides: O): Bag<F> {
    return new Bag<F>({ ...this.factories, ...overrides });
  }
}

class Builder<F extends Factories> {
  constructor(private readonly factories: F) {}

  add<N extends Factories>(more: N & Pick<Checked<Merge<F, N>>, keyof N>): Builder<Merge<F, N>> {
    return new Builder({ ...this.factories, ...more } as Merge<F, N>);
  }

  get end(): EndOf<F> {
    return (() => new Bag(this.factories)) as EndOf<F>;
  }
}

export const DiBag = { begin: (): Builder<Record<never, never>> => new Builder({}) };
