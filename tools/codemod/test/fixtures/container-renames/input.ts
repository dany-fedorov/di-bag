import { DiBag, type Bag, type ObserverOptions, type ScopeOptions } from 'di-bag/node';
const root = DiBag.createBuilder().register({ a: () => 1, b: () => 2 }).build();
const keys = ['a'] as const;
const replacements = { a: () => 3 };
const sharing = { share: ['b'] as const };
const observer: ObserverOptions = { onEvent() {}, onError() {} };
export const configured = DiBag.withConfiguration({ observers: [observer] });
export const a = root.inspect('a');
export const graph = root.inspectGraph();
export const child0 = root.createScope();
export const child1 = root.createScope({ share: ['b'] });
export const child2 = root.createScope(keys, replacements);
export const child3 = root.createScope(keys /* k */, replacements /* p */, { share: ['b'], });
export const manual = root.createScope(keys, replacements, sharing);
export const fork0 = root.fork();
export const fork1 = root.fork(keys, replacements);
export const preserved = root.createScope(
  keys, // selected keys stay commented
  replacements, // providers keep the trailing comma
);
export const nested = root.fork(['a'], { a: () => DiBag.createBuilder().register({ inner: () => 1 }).build().resolve('inner') });
export type App = Bag<{ a: () => number }>;
export type ChildOptions = ScopeOptions<{ a: () => number }, readonly ['a']>;
const collectionKey = Symbol('collection');
const collection = DiBag.token(collectionKey).of<number>();
const collectionContainer = DiBag.createBuilder().contribute(collection, () => 1).build();
export const collectionSnapshots = collectionContainer.inspectAll(collection);
