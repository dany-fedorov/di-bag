import type { Bag, Provided, SelectionKey, TokenBase, TokenMember } from '../src';
import type { Registrations } from '../src/registration';
type R = {
    a: () => number;
    b: () => string;
};
export declare const optionalValue: number | undefined;
export declare const anyValue: any;
export declare function concreteK<K extends 'a' | 'b'>(key: K & ([K] extends [string] ? unknown : TokenMember<R, K>)): Provided<R>[K];
export declare function genericSelection<R extends Registrations, K extends (keyof R & string) | TokenBase>(bag: Bag<R>, key: K & ([K] extends [string] ? unknown : TokenMember<R, K>)): Provided<R>[SelectionKey<K> & keyof R];
export declare function genericNoInfer<R extends Registrations, K extends (keyof R & string) | TokenBase>(bag: Bag<NoInfer<R>>, key: K & ([K] extends [string] ? unknown : TokenMember<R, K>)): Provided<R>[SelectionKey<K> & keyof R];
export declare function genericReflected<R extends Registrations>(resolve: Bag<R>['resolve']): Bag<R>['resolve'];
export declare function genericWiden<R extends Registrations>(bag: Bag<R>): Bag<R>;
export {};
