import { DiBag } from 'di-bag';

const singleSymbol = Symbol('single'); export const single = DiBag.createToken(singleSymbol).forService<number>();
const collectionSymbol = Symbol('collection'); export const collection = DiBag.createToken(collectionSymbol).forCollectionOf<number>();
const mixedSymbol = Symbol('mixed'); export const mixed = DiBag.createToken(mixedSymbol).of<number>();
const aliasOnlySymbol = Symbol('alias-only'); export const aliasOnly = DiBag.createToken(aliasOnlySymbol).forCollectionOf<number>();
const inlineSymbol = Symbol('inline');
const builder = DiBag.createBuilder()
  .withTokenService(single, () => 1)
  .withCollectionContribution({ collectionToken: collection, provider: () => 2 })
  .withTokenService(mixed, () => 3)
  .withCollectionContribution({ collectionToken: mixed, provider: () => 4 })
  .withCollectionContribution({ collectionToken: DiBag.createToken(inlineSymbol).of<number>(), provider: () => 5 })
  .withServices({ total: DiBag.createProviderFromFunction({ dependencies: [collection], factoryFunction: values => values.length }) });
export const bag = builder.buildContainer();
export const values = bag.resolveCollection(collection);
