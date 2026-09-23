import { DiBag, type Container, type LifecycleObserver, type CreateChildContainerOptions } from 'di-bag';
const root = DiBag.createBuilder().withServices({ a: () => 1, b: () => 2 }).buildContainer();
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
export const nested = root.createIndependentContainer(['a'], { a: () => DiBag.createBuilder().withServices({ inner: () => 1 }).buildContainer().resolve('inner') });
export type App = Container<{ a: () => number }>;
export type ChildOptions = CreateChildContainerOptions<{ a: () => number }, readonly ['a']>;
const collectionKey = Symbol('collection');
const collection = DiBag.token(collectionKey).forCollectionOf<number>();
const collectionContainer = DiBag.createBuilder().withCollectionContribution({ collectionToken: collection, provider: () => 1 }).buildContainer();
export const collectionSnapshots = collectionContainer.serviceSnapshot(collection);
