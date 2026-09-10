/** Private immutable hash trie. Versions share nodes, never map wrappers or caches. */
type Key = string | symbol;
type Leaf<V> = { readonly kind: 'leaf'; readonly hash: number; readonly key: Key; readonly value: V };
type Collision<V> = { readonly kind: 'collision'; readonly hash: number; readonly entries: readonly Leaf<V>[] };
type Branch<V> = { readonly kind: 'branch'; readonly bitmap: number; readonly children: readonly Node<V>[] };
type Node<V> = Leaf<V> | Collision<V> | Branch<V>;

// Registered symbols cannot be weak keys. Hash their registry strings; local and
// well-known symbols use collectible identities where the host supports them.
const symbolHashes = new WeakMap<object, number>();
let nextSymbolHash = 0;
const weakSymbols = (() => {
  try { symbolHashes.set(Symbol() as unknown as object, 0); return true; }
  catch { return false; }
})();
function stringHash(key: string): number {
  let hash = 2166136261;
  for (let i = 0; i < key.length; i++) hash = Math.imul(hash ^ key.charCodeAt(i), 16777619);
  return hash >>> 0;
}
function hashKey(key: Key): number {
  if (typeof key === 'string') return stringHash(key);
  const registered = Symbol.keyFor(key);
  if (registered !== undefined) return stringHash(registered);
  if (!weakSymbols) return stringHash(String(key));
  const weakKey = key as unknown as object;
  let hash = symbolHashes.get(weakKey);
  if (hash === undefined) {
    hash = nextSymbolHash = (nextSymbolHash + 1) >>> 0;
    symbolHashes.set(weakKey, hash);
  }
  return hash;
}
function index(bitmap: number, bit: number): number {
  let bits = bitmap & (bit - 1);
  bits -= (bits >>> 1) & 0x5555;
  bits = (bits & 0x3333) + ((bits >>> 2) & 0x3333);
  return (((bits + (bits >>> 4)) & 0x0f0f) * 0x0101 >>> 8) & 0xff;
}
function join<V>(left: Leaf<V> | Collision<V>, right: Leaf<V>, shift: number): Node<V> {
  if (left.hash === right.hash) return { kind: 'collision', hash: right.hash, entries: left.kind === 'leaf' ? [left, right] : [...left.entries, right] };
  const a = (left.hash >>> shift) & 15, b = (right.hash >>> shift) & 15;
  return a === b
    ? { kind: 'branch', bitmap: 1 << a, children: [join(left, right, shift + 4)] }
    : { kind: 'branch', bitmap: (1 << a) | (1 << b), children: a < b ? [left, right] : [right, left] };
}
function put<V>(node: Node<V> | undefined, leaf: Leaf<V>, shift: number): Node<V> {
  if (!node) return leaf;
  if (node.kind === 'leaf') return node.key === leaf.key ? leaf : join(node, leaf, shift);
  if (node.kind === 'collision') {
    if (node.hash !== leaf.hash) return join(node, leaf, shift);
    const at = node.entries.findIndex(entry => entry.key === leaf.key);
    if (at < 0) return { ...node, entries: [...node.entries, leaf] };
    const entries = node.entries.slice(); entries[at] = leaf;
    return { ...node, entries };
  }
  const bit = 1 << ((leaf.hash >>> shift) & 15), at = index(node.bitmap, bit);
  const children = node.children.slice();
  if (node.bitmap & bit) children[at] = put(children[at], leaf, shift + 4);
  else children.splice(at, 0, leaf);
  return { kind: 'branch', bitmap: node.bitmap | bit, children };
}
function remove<V>(node: Node<V> | undefined, key: Key, hash: number, shift: number): Node<V> | undefined {
  if (!node) return undefined;
  if (node.kind === 'leaf') return node.key === key ? undefined : node;
  if (node.kind === 'collision') {
    const at = node.entries.findIndex(entry => entry.key === key);
    if (at < 0) return node;
    const entries = node.entries.slice(); entries.splice(at, 1);
    return entries.length === 1 ? entries[0] : { ...node, entries };
  }
  const bit = 1 << ((hash >>> shift) & 15);
  if (!(node.bitmap & bit)) return node;
  const at = index(node.bitmap, bit), previous = node.children[at];
  const child = remove(previous, key, hash, shift + 4);
  if (child === previous) return node;
  const children = node.children.slice();
  if (child) children[at] = child;
  else children.splice(at, 1);
  if (children.length === 0) return undefined;
  // A branch cannot move up: its bitmap describes a particular hash nibble.
  if (children.length === 1 && children[0]!.kind !== 'branch') return children[0];
  return { kind: 'branch', bitmap: child ? node.bitmap : node.bitmap & ~bit, children };
}
export class PersistentMap<V> {
  constructor(private readonly root?: Node<V>) {}
  get(key: Key): V | undefined {
    const hash = hashKey(key);
    let node = this.root, shift = 0;
    while (node?.kind === 'branch') {
      const bit = 1 << ((hash >>> shift) & 15);
      if (!(node.bitmap & bit)) return undefined;
      node = node.children[index(node.bitmap, bit)]; shift += 4;
    }
    if (node?.kind === 'leaf') return node.key === key ? node.value : undefined;
    return node?.entries.find(entry => entry.key === key)?.value;
  }
  has(key: Key): boolean { return this.get(key) !== undefined; }
  set(key: Key, value: V): PersistentMap<V> {
    return new PersistentMap(put(this.root, { kind: 'leaf', key, hash: hashKey(key), value }, 0));
  }
  delete(key: Key): PersistentMap<V> { return new PersistentMap(remove(this.root, key, hashKey(key), 0)); }
  *[Symbol.iterator](): IterableIterator<readonly [Key, V]> {
    const stack = this.root ? [this.root] : [];
    while (stack.length) {
      const node = stack.pop()!;
      if (node.kind === 'branch') stack.push(...node.children);
      else if (node.kind === 'collision') for (const entry of node.entries) yield [entry.key, entry.value];
      else yield [node.key, node.value];
    }
  }
}
