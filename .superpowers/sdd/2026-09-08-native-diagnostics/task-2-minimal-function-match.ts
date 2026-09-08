declare const errorBrand: unique symbol;
type Unsatisfied<Message extends string> = { readonly [errorBrand]: Message };
type IsUnion<T, Whole = T> = T extends Whole ? [Whole] extends [T] ? false : true : never;
type Singleton<K> = [K] extends [never] ? false : [K] extends [string]
  ? true extends IsUnion<K> ? false : string extends K ? false : true
  : false;
type InvalidReplacement<K> = Unsatisfied<'replace requires one existing singleton string-literal key'> &
  { readonly key?: K };
type ReplacementKey<R, K extends string> = Singleton<K> extends true
  ? K extends keyof R ? unknown : Unsatisfied<'replace accepts existing tokens only'>
  : InvalidReplacement<K>;

declare class TokenBase { private readonly nominal: void; }
type ReplacementAdmission<R, K extends string | TokenBase> =
  [K] extends [string] ? ReplacementKey<R, K> : unknown;
type ReplacedEntries<E, K, V> = [K] extends [string]
  ? Exclude<E, { key: K }> | { key: K; registration: V }
  : E;
type ReplacementState<E, K, V> = { readonly entries: ReplacedEntries<E, K, V> };

interface Builder<E> {
  replace<const K extends string, V extends () => number>(
    key: K & ReplacementKey<{ a: () => number; b: () => number }, K>,
    registration: V,
  ): Builder<Exclude<E, { key: K }> | { key: K; registration: V }>;
  replace<const K extends string | TokenBase, V extends () => unknown>(
    key: K & NoInfer<ReplacementAdmission<{ a: () => number; b: () => number }, K>>,
    registration: V,
  ): Builder<ReplacementState<E, K, V>['entries']>;
}

type FunctionMatch = Builder<never>['replace'] extends (...args: any) => infer R
  ? { matched: true; result: R }
  : { matched: false };
type IsAny<T> = 0 extends (1 & T) ? true : false;
type Assert<T extends true> = T;
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends
  (<T>() => T extends B ? 1 : 2) ? true : false;
type FunctionMatchHolds = Assert<Equal<FunctionMatch['matched'], true>>;
type ResultIsNotAny = Assert<Equal<IsAny<FunctionMatch['result']>, false>>;

declare const builder: Builder<never>;
declare const union: 'a' | 'b';
builder.replace(union, () => 1);
