/**
 * Providing a TypeProvider of format { prop: valType } means
 * that factories type is to be inferred from it to be { prop: (argsType) => SasBox<ValBox<valType, any>>.
 * This means that I cannot encode unboxing into a type.
 *
 * Can I do a pattern like this ?
 * ```typescript
 * DiBag.begin().factories({ a: () => SasBox.fromSync(() => ValBox.new(213))})
 * DiBag.begin().factories.sync({ a: () => ValBox.new(213) })
 * DiBag.begin().factories.sync.unboxed({ a: () => 213 })
 * ---
 * or maybe make sync.unboxed the default ? yeah, I think so
 * ```
 */

type FactoriesBoxed = {
  (): 123; // <- sync, boxed
};

type FactoriesUnboxed = {
  (): 123; // <- unboxed, sync
};

type Factories = {
  (): null; // <- sync, unboxed
  boxed: FactoriesBoxed;
  unboxed: FactoriesUnboxed;
};

type Begin = {
  factories: Factories;
};

const begin = (): Begin => {};
