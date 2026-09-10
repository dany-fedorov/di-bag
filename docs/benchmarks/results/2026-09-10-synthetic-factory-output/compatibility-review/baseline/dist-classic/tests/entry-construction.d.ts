import type { Entries, Registration } from '../src';
export declare function makeEntry<K extends string | symbol, V extends Registration>(key: K, registration: V): Entries<Record<K, V>>;
export declare function wrapEntry<K extends string | symbol, V extends Registration>(entry: {
    key: K;
    registration: V;
}): Entries<Record<K, V>>;
export declare function makeNamed<K extends string, V extends Registration>(key: K, registration: V): Entries<Record<K, V>>;
export declare function makeSymbol<K extends symbol, V extends Registration>(key: K, registration: V): Entries<Record<K, V>>;
export declare const named: {
    key: "value";
    registration: () => number;
};
export declare const key: unique symbol;
export declare const symbolic: {
    key: typeof key;
    registration: () => number;
};
