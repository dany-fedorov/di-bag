import type { Bag, Provided, Provider, ProviderOutput, SelectionKey, TokenBase, TokenMember } from '../src';
import type { Registrations } from '../src/registration';
type Equal<A,B>=(<T>()=>T extends A?1:2) extends (<T>()=>T extends B?1:2)?true:false;
type Assert<T extends true>=T;
type R={a:()=>number;b:()=>string};
declare const bag:Bag<R>;
declare const optional:Bag<{a?:()=>number}>;
declare const anyKey:any;
export const optionalValue=optional.resolve('a');
export const anyValue=bag.resolve(anyKey);
type Optional=Assert<Equal<typeof optionalValue,number|undefined>>;
type Any=Assert<Equal<typeof anyValue,any>>;

export function concreteK<K extends 'a'|'b'>(key:K & ([K] extends [string]?unknown:TokenMember<R,K>)):Provided<R>[K]{return bag.resolve<K>(key);}
export function genericSelection<R extends Registrations,K extends (keyof R&string)|TokenBase>(bag:Bag<R>,key:K & ([K] extends [string]?unknown:TokenMember<R,K>)):Provided<R>[SelectionKey<K>&keyof R]{return bag.resolve<K>(key);}
export function genericNoInfer<R extends Registrations,K extends (keyof R&string)|TokenBase>(bag:Bag<NoInfer<R>>,key:K & ([K] extends [string]?unknown:TokenMember<R,K>)):Provided<R>[SelectionKey<K>&keyof R]{return bag.resolve<K>(key);}
type Resolver<R extends Registrations>=<K extends (keyof R&string)|TokenBase>(key:K & ([K] extends [string]?unknown:TokenMember<R,K>))=>Provided<R>[SelectionKey<K>&keyof R];
declare const oldResolve:Resolver<R>;
export function genericReflected<R extends Registrations>(resolve:Bag<R>['resolve']):Bag<R>['resolve']{return resolve;}
export function genericWiden<R extends Registrations>(bag:Bag<R>):Bag<R>{return bag;}
