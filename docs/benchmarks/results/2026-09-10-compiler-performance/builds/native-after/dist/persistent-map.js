"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PersistentMap = void 0;
// Registered symbols cannot be weak keys. Hash their registry strings; local and
// well-known symbols use collectible identities where the host supports them.
const symbolHashes = new WeakMap();
let nextSymbolHash = 0;
const weakSymbols = (() => {
    try {
        symbolHashes.set(Symbol(), 0);
        return true;
    }
    catch {
        return false;
    }
})();
function stringHash(key) {
    let hash = 2166136261;
    for (let i = 0; i < key.length; i++)
        hash = Math.imul(hash ^ key.charCodeAt(i), 16777619);
    return hash >>> 0;
}
function hashKey(key) {
    if (typeof key === 'string')
        return stringHash(key);
    const registered = Symbol.keyFor(key);
    if (registered !== undefined)
        return stringHash(registered);
    if (!weakSymbols)
        return stringHash(String(key));
    const weakKey = key;
    let hash = symbolHashes.get(weakKey);
    if (hash === undefined) {
        hash = nextSymbolHash = (nextSymbolHash + 1) >>> 0;
        symbolHashes.set(weakKey, hash);
    }
    return hash;
}
function index(bitmap, bit) {
    let bits = bitmap & (bit - 1);
    bits -= (bits >>> 1) & 0x5555;
    bits = (bits & 0x3333) + ((bits >>> 2) & 0x3333);
    return (((bits + (bits >>> 4)) & 0x0f0f) * 0x0101 >>> 8) & 0xff;
}
function join(left, right, shift) {
    if (left.hash === right.hash)
        return { kind: 'collision', hash: right.hash, entries: left.kind === 'leaf' ? [left, right] : [...left.entries, right] };
    const a = (left.hash >>> shift) & 15, b = (right.hash >>> shift) & 15;
    return a === b
        ? { kind: 'branch', bitmap: 1 << a, children: [join(left, right, shift + 4)] }
        : { kind: 'branch', bitmap: (1 << a) | (1 << b), children: a < b ? [left, right] : [right, left] };
}
function put(node, leaf, shift) {
    if (!node)
        return leaf;
    if (node.kind === 'leaf')
        return node.key === leaf.key ? leaf : join(node, leaf, shift);
    if (node.kind === 'collision') {
        if (node.hash !== leaf.hash)
            return join(node, leaf, shift);
        const at = node.entries.findIndex(entry => entry.key === leaf.key);
        if (at < 0)
            return { ...node, entries: [...node.entries, leaf] };
        const entries = node.entries.slice();
        entries[at] = leaf;
        return { ...node, entries };
    }
    const bit = 1 << ((leaf.hash >>> shift) & 15), at = index(node.bitmap, bit);
    const children = node.children.slice();
    if (node.bitmap & bit)
        children[at] = put(children[at], leaf, shift + 4);
    else
        children.splice(at, 0, leaf);
    return { kind: 'branch', bitmap: node.bitmap | bit, children };
}
function remove(node, key, hash, shift) {
    if (!node)
        return undefined;
    if (node.kind === 'leaf')
        return node.key === key ? undefined : node;
    if (node.kind === 'collision') {
        const at = node.entries.findIndex(entry => entry.key === key);
        if (at < 0)
            return node;
        const entries = node.entries.slice();
        entries.splice(at, 1);
        return entries.length === 1 ? entries[0] : { ...node, entries };
    }
    const bit = 1 << ((hash >>> shift) & 15);
    if (!(node.bitmap & bit))
        return node;
    const at = index(node.bitmap, bit), previous = node.children[at];
    const child = remove(previous, key, hash, shift + 4);
    if (child === previous)
        return node;
    const children = node.children.slice();
    if (child)
        children[at] = child;
    else
        children.splice(at, 1);
    if (children.length === 0)
        return undefined;
    // A branch cannot move up: its bitmap describes a particular hash nibble.
    if (children.length === 1 && children[0].kind !== 'branch')
        return children[0];
    return { kind: 'branch', bitmap: child ? node.bitmap : node.bitmap & ~bit, children };
}
class PersistentMap {
    root;
    constructor(root) {
        this.root = root;
    }
    get(key) {
        const hash = hashKey(key);
        let node = this.root, shift = 0;
        while (node?.kind === 'branch') {
            const bit = 1 << ((hash >>> shift) & 15);
            if (!(node.bitmap & bit))
                return undefined;
            node = node.children[index(node.bitmap, bit)];
            shift += 4;
        }
        if (node?.kind === 'leaf')
            return node.key === key ? node.value : undefined;
        return node?.entries.find(entry => entry.key === key)?.value;
    }
    has(key) { return this.get(key) !== undefined; }
    set(key, value) {
        return new PersistentMap(put(this.root, { kind: 'leaf', key, hash: hashKey(key), value }, 0));
    }
    delete(key) { return new PersistentMap(remove(this.root, key, hashKey(key), 0)); }
    *[Symbol.iterator]() {
        const stack = this.root ? [this.root] : [];
        while (stack.length) {
            const node = stack.pop();
            if (node.kind === 'branch')
                stack.push(...node.children);
            else if (node.kind === 'collision')
                for (const entry of node.entries)
                    yield [entry.key, entry.value];
            else
                yield [node.key, node.value];
        }
    }
}
exports.PersistentMap = PersistentMap;
