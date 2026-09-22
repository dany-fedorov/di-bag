import { DiBag } from '../../../src';

const serviceKey = Symbol('service');
const service = DiBag.token(serviceKey).of<number>();
const collectionKey = Symbol('collection');
const collection = DiBag.token(collectionKey).forCollectionOf<number>();
const builder = DiBag.createBuilder().contribute(collection, () => 1);
const sharedKey = Symbol('shared');
const sharedService = DiBag.token(sharedKey).of<number>();
const sharedCollection = DiBag.token(sharedKey).forCollectionOf<number>();
const emptyBag = DiBag.createBuilder().build();

service satisfies typeof service;
// diagnostic: register requires a single-service token
DiBag.createBuilder().register(collection, () => [1]);
// diagnostic: alias destination requires a single-service token
DiBag.createBuilder().register({ value: () => 1 }).alias(collection, 'value');
// diagnostic: optional requires a single-service token
DiBag.optional(collection);
// diagnostic: createScope cannot share a collection token
builder.build().createScope({ share: [collection] as const });
// diagnostic: buildModule cannot export a collection token
builder.buildModule([collection] as const);
// diagnostic: token binding output is not assignable to its service
builder.replace(collection, () => [1, 'wrong']);
// diagnostic: token binding output is not assignable to its service
builder.build().fork([collection] as const, { [collection.key]: () => ['wrong'] });
// diagnostic: token symbol is already a single service in this graph
DiBag.createBuilder().register(sharedService, () => 1).contribute(sharedCollection, () => 2);
// diagnostic: token symbol is already a collection in this graph
DiBag.createBuilder().contribute(sharedCollection, () => 2).register(sharedService, () => 1);
// diagnostic: operation requires a single-service token
emptyBag.resolve(collection);
// diagnostic: operation requires a single-service token
emptyBag.inspect(collection);
