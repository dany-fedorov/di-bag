import type { Bag, Provided, TokenBase, TokenMember, SelectionKey } from '../src';
import type { Registrations } from '../src/registration';
type R = {
    a: () => number;
    b: () => string;
    promise: () => Promise<42>;
    fn: () => ((x: number) => string);
    object: () => {
        readonly kind: 'object';
        readonly value: 1;
    };
};
export declare const bag: Bag<R>;
export declare const optionalValue: number | undefined;
export declare const optionalUnionValue: string | number | undefined;
export declare const indexValue: number;
export declare const templateValue: number;
export declare const unionMapValue: 1 | 3;
export declare const mixedValue: 2 | 1;
export declare const opaqueValue: unknown;
export declare const anyRegistration: unknown;
export declare const neverRegistration: never;
export declare const neverFactory: never;
export declare const anyMapValue: unknown;
export declare const neverMapValue: never;
export declare const anyValue: any;
export declare const neverValue: never;
export declare const unionValue: string | number;
export declare const promise: Promise<42>;
export declare const fn: (x: number) => string;
export declare const object: {
    readonly kind: "object";
    readonly value: 1;
};
export declare const call: string;
export declare const awaited: Promise<42>;
export declare const spread: {
    kind: "object";
    value: 1;
};
export declare const passedPromise: Promise<42>;
export declare const passedObject: {
    readonly kind: "object";
    readonly value: 1;
};
export declare const passedFunction: (x: number) => string;
export declare const applied: number;
export declare const appliedPromise: Promise<42>;
export declare const callbackValue: {
    readonly kind: "object";
    readonly value: 1;
};
export declare const mapValues: (string | number)[];
export declare const mapPromises: Promise<42>[];
export declare const narrowed: (key: 'a') => number;
export declare const narrowedPromise: (key: 'promise') => Promise<42>;
export declare const specialized: (token: "promise") => Promise<42>;
export declare function concreteK<K extends 'a' | 'b'>(key: K & ([K] extends [string] ? unknown : TokenMember<R, K>)): Provided<R>[K];
export declare function genericSelection<R extends Registrations, K extends (keyof R & string) | TokenBase>(bag: Bag<R>, key: K & ([K] extends [string] ? unknown : TokenMember<R, K>)): Provided<R>[SelectionKey<K> & keyof R];
export declare function genericNoInfer<R extends Registrations, K extends (keyof R & string) | TokenBase>(bag: Bag<NoInfer<R>>, key: K & ([K] extends [string] ? unknown : TokenMember<R, K>)): Provided<R>[SelectionKey<K> & keyof R];
export declare function inferredSelection<R extends Registrations, K extends (keyof R & string) | TokenBase>(bag: Bag<R>, key: K & ([K] extends [string] ? unknown : TokenMember<R, K>)): Provided<R>[SelectionKey<K> & keyof R];
export declare function genericValue<T>(bag: Bag<{
    a: () => T;
}>): T;
export declare function genericReflected<R extends Registrations>(resolve: Bag<R>['resolve']): Bag<R>['resolve'];
export declare function genericWiden<R extends Registrations>(bag: Bag<R>): Bag<R>;
export declare const concreteBag: Bag<{
    a: () => number;
}>;
export declare const tokenKey: unique symbol;
export declare const numberToken: import("../src").Token<typeof tokenKey, number>;
export declare const promisedKey: unique symbol;
export declare const promiseToken: import("../src").Token<typeof promisedKey, Promise<42>>;
export declare const tokenBag: Bag<import("../src").From<{
    key: typeof tokenKey;
    registration: import("../src").Binding<import("../src").Token<typeof tokenKey, number>, () => number>;
} | {
    key: typeof promisedKey;
    registration: import("../src").Binding<import("../src").Token<typeof promisedKey, Promise<42>>, () => Promise<42>>;
}>, never>;
export declare const tokenValue: number;
export declare const tokenPromise: Promise<42>;
export {};
