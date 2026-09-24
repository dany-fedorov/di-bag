import { DiBag, type Container, type LifecycleObserver, type CreateChildContainerOptions } from 'di-bag';
const root = DiBag.createBuilder().withServices({ a: DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'scoped:one-per-container' }), b: DiBag.providerWithLifetime({ provider: () => 2, lifetime: 'scoped:one-per-container' }) }).buildContainer();
const keys = ['a'] as const;
const replacements = { a: () => 3 };
const sharing = { share: ['b'] as const };
const observer: LifecycleObserver = { onLifecycleEvent() {}, onObserverFailure() {} };
export const configured = DiBag.withConfiguration({ lifecycleObservers: [observer] });
export const a = root.serviceSnapshot('a');
export const graph = root.graphSnapshot();
export const child0 = root.createChildContainer();
export const child1 = root.createChildContainer({ sharedParentServiceKeys: ['b'] });
export const child2 = root.createChildContainer(keys, replacements);
export const child3 = root.createChildContainer(keys /* k */, replacements /* p */, { sharedParentServiceKeys: ['b'], });
export const manual = root.createScope(keys, replacements, sharing);
export const fork0 = root.createIndependentContainer();
export const fork1 = root.createIndependentContainer(keys, replacements);
export const preserved = root.createChildContainer(
  keys, // selected keys stay commented
  replacements, // providers keep the trailing comma
);
export const nested = root.createIndependentContainer(['a'], { a: DiBag.providerWithLifetime({ provider: () => DiBag.createBuilder().withServices({ inner: DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'scoped:one-per-container' }) }).buildContainer().resolve('inner'), lifetime: 'scoped:one-per-container' }) });
export type App = Container<{ a: () => number }>;
export type ChildOptions = CreateChildContainerOptions<{ a: () => number }, readonly ['a']>;
const collectionKey = Symbol('collection');
const collection = DiBag.createToken(collectionKey).forCollectionOf<number>();
const collectionContainer = DiBag.createBuilder().withCollectionContribution({ collectionToken: collection, provider: DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'scoped:one-per-container' }) }).buildContainer();
export const collectionSnapshots = collectionContainer.serviceSnapshot(collection);
