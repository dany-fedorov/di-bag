import { DiBag } from '../../../src';

const serviceKey = Symbol('service');
const service = DiBag.token(serviceKey).of<number>();
const collectionKey = Symbol('collection');
const collection = DiBag.token(collectionKey).forCollectionOf<number>();
const builder = DiBag.createBuilder().withCollectionContribution({ collectionToken: collection, provider: () => 1 });
const sharedKey = Symbol('shared');
const sharedService = DiBag.token(sharedKey).of<number>();
const sharedCollection = DiBag.token(sharedKey).forCollectionOf<number>();
const emptyBag = DiBag.createBuilder().buildContainer();

service satisfies typeof service;
// diagnostic: withTokenService requires a single-service token
DiBag.createBuilder().withTokenService(collection, () => [1]);
// diagnostic: withServiceAlias destination requires a single-service token
DiBag.createBuilder().withServices({ value: (): readonly number[] => [] }).withServiceAlias({ aliasKey: collection, targetServiceKey: 'value' });
// diagnostic: optional requires a single-service token
DiBag.optional(collection);
// diagnostic: createChildContainer cannot share a collection token
builder.buildContainer().createChildContainer({ sharedParentServiceKeys: [collection] as const });
// diagnostic: buildModule cannot export a collection token
builder.buildModule({ exportedServiceKeys: [collection] as const });
// diagnostic: token binding output is not assignable to its service
builder.withReplacedService(collection, () => [1, 'wrong']);
// diagnostic: token binding output is not assignable to its service
builder.buildContainer().createIndependentContainer([collection] as const, { [collection.key]: () => ['wrong'] });
// diagnostic: token symbol is already a single service in this graph
DiBag.createBuilder().withTokenService(sharedService, () => 1).withCollectionContribution({ collectionToken: sharedCollection, provider: () => 2 });
// diagnostic: token symbol is already a collection in this graph
DiBag.createBuilder().withCollectionContribution({ collectionToken: sharedCollection, provider: () => 2 }).withTokenService(sharedService, () => 1);
// diagnostic: operation requires a single-service token
emptyBag.resolve(collection);
emptyBag.serviceSnapshot(collection);
// diagnostic: withCollectionContribution requires a collection token
DiBag.createBuilder().withCollectionContribution({ collectionToken: service, provider: () => 1 });

const sealedCollectionKey = Symbol('sealed collection');
const sealedNumbers = DiBag.token(sealedCollectionKey).forCollectionOf<number>();
const sealedStrings = DiBag.token(sealedCollectionKey).forCollectionOf<string>();
const sealedConsumer = DiBag.createBuilder()
  .withServices({ count: DiBag.fromFunction([sealedNumbers], values => values.length) })
  .buildModule({ exportedServiceKeys: ['count'] });
// diagnostic: collection token has an incompatible or opaque contract
DiBag.createBuilder().withInstalledModules([sealedConsumer]).withCollectionContribution({ collectionToken: sealedStrings, provider: () => 'wrong' });

const nestedSealedConsumer = DiBag.createBuilder()
  .withInstalledModules([sealedConsumer])
  .buildModule({ exportedServiceKeys: ['count'] });
// diagnostic: collection token has an incompatible or opaque contract
DiBag.createBuilder().withInstalledModules([nestedSealedConsumer]).withCollectionContribution({ collectionToken: sealedStrings, provider: () => 'wrong' });
