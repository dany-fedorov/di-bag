/** Private immutable hash trie. Versions share nodes, never map wrappers or caches. */
type Key = string | symbol;
type Leaf<V> = {
    readonly kind: 'leaf';
    readonly hash: number;
    readonly key: Key;
    readonly value: V;
};
type Collision<V> = {
    readonly kind: 'collision';
    readonly hash: number;
    readonly entries: readonly Leaf<V>[];
};
type Branch<V> = {
    readonly kind: 'branch';
    readonly bitmap: number;
    readonly children: readonly Node<V>[];
};
type Node<V> = Leaf<V> | Collision<V> | Branch<V>;
export declare class PersistentMap<V> {
    private readonly root?;
    constructor(root?: Node<V> | undefined);
    get(key: Key): V | undefined;
    has(key: Key): boolean;
    set(key: Key, value: V): PersistentMap<V>;
    delete(key: Key): PersistentMap<V>;
    [Symbol.iterator](): IterableIterator<readonly [Key, V]>;
}
export {};
