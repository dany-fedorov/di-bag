import { DiBag } from 'di-bag';

const singleSymbol = Symbol('single'); export const single = DiBag.token(singleSymbol).of<number>();
const collectionSymbol = Symbol('collection'); export const collection = DiBag.token(collectionSymbol).of<number>();
const mixedSymbol = Symbol('mixed'); export const mixed = DiBag.token(mixedSymbol).of<number>();
const aliasOnlySymbol = Symbol('alias-only'); export const aliasOnly = DiBag.token(aliasOnlySymbol).of<number>();
const inlineSymbol = Symbol('inline');
const builder = DiBag.createBuilder()
  .register(single, () => 1)
  .contribute(collection, () => 2)
  .register(mixed, () => 3)
  .contribute(mixed, () => 4)
  .contribute(DiBag.token(inlineSymbol).of<number>(), () => 5)
  .register({ total: DiBag.fromFunction([DiBag.all(collection)], values => values.length) });
export const bag = builder.build();
export const values = bag.resolveAll(collection);
