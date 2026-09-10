import { DiBag } from '../src';
import type { Bag, Provided, Provider, ProviderOutput, TokenBase, TokenMember, SelectionKey } from '../src';
import type { Registrations } from '../src/registration';
import type { ProviderBase } from '../src/provider';
type Equal<A,B>=(<T>()=>T extends A?1:2) extends (<T>()=>T extends B?1:2)?true:false;
type Assert<T extends true>=T;
type R={a:()=>number;b:()=>string;promise:()=>Promise<42>;fn:()=>((x:number)=>string);object:()=>{readonly kind:'object';readonly value:1}};
export declare const bag:Bag<R>;
declare const optional:Bag<{a?:()=>number}>;
declare const optionalUnion:Bag<{a?:()=>number}|{a:()=>string}>;
declare const indexed:Bag<Record<string,()=>number>>;
declare const template:Bag<{[K in `prefix:${string}`]:()=>number}>;
declare const unionMap:Bag<{a:()=>1;b:()=>2}|{a:()=>3;c:()=>4}>;
declare const mixed:Bag<{a:(()=>1)|Provider<()=>2>;b:ProviderBase;c:any;d:never;e:()=>never}>;
declare const anyMap:Bag<any>;
declare const neverMap:Bag<never>;
declare const anyKey:any;
declare const neverKey:never;
declare const unionKey:'a'|'b';
export const optionalValue=optional.resolve('a');
export const optionalUnionValue=optionalUnion.resolve('a');
export const indexValue=indexed.resolve('a');
export const templateValue=template.resolve('prefix:a');
export const unionMapValue=unionMap.resolve('a');
export const mixedValue=mixed.resolve('a');
export const opaqueValue=mixed.resolve('b');
export const anyRegistration=mixed.resolve('c');
export const neverRegistration=mixed.resolve('d');
export const neverFactory=mixed.resolve('e');
export const anyMapValue=anyMap.resolve('a');
export const neverMapValue=neverMap.resolve('a');
export const anyValue=bag.resolve(anyKey);
export const neverValue=bag.resolve(neverKey);
export const unionValue=bag.resolve(unionKey);
export const promise=bag.resolve('promise');
export const fn=bag.resolve('fn');
export const object=bag.resolve('object');
export const call=fn(1);
export const awaited=promise.then(value=>value);
export const spread={...object};
type ConcreteAssertions=[
 Assert<Equal<typeof optionalValue,number|undefined>>,
 Assert<Equal<typeof optionalUnionValue,number|string|undefined>>,
 Assert<Equal<typeof indexValue,number>>,
 Assert<Equal<typeof templateValue,number>>,
 Assert<Equal<typeof unionMapValue,1|3>>,
 Assert<Equal<typeof mixedValue,1|2>>,
 Assert<Equal<typeof opaqueValue,unknown>>,
 Assert<Equal<typeof anyRegistration,unknown>>,
 Assert<Equal<typeof neverRegistration,never>>,
 Assert<Equal<typeof neverFactory,never>>,
 Assert<Equal<typeof anyMapValue,unknown>>,
 Assert<Equal<typeof neverMapValue,never>>,
 Assert<Equal<typeof anyValue,any>>,
 Assert<Equal<typeof neverValue,never>>,
 Assert<Equal<typeof unionValue,number|string>>,
 Assert<Equal<typeof promise,Promise<42>>>,
 Assert<Equal<typeof fn,(x:number)=>string>>,
 Assert<Equal<typeof object,{readonly kind:'object';readonly value:1}>>,
 Assert<Equal<typeof call,string>>,
 Assert<Equal<typeof awaited,Promise<42>>>
];
declare function identity<T>(value:T):T;
declare function apply<K,V>(key:K,fn:(key:K)=>V):V;
declare function resultType<V>(fn:()=>V):V;
export const passedPromise=identity(promise);
export const passedObject=identity(object);
export const passedFunction=identity(fn);
export const applied=apply('a' as const,bag.resolve);
export const appliedPromise=apply('promise' as const,bag.resolve);
export const callbackValue=resultType(()=>bag.resolve('object'));
export const mapValues=(['a','b'] as const).map(key=>bag.resolve(key));
export const mapPromises=(['promise'] as const).map(key=>bag.resolve(key));
export const narrowed:(key:'a')=>number=bag.resolve;
export const narrowedPromise:(key:'promise')=>Promise<42>=bag.resolve;
export const specialized=bag.resolve<'promise'>;
type HigherOrderAssertions=[
 Assert<Equal<typeof passedPromise,Promise<42>>>,
 Assert<Equal<typeof passedObject,typeof object>>,
 Assert<Equal<typeof passedFunction,(x:number)=>string>>,
 Assert<Equal<typeof applied,number>>,
 Assert<Equal<typeof appliedPromise,Promise<42>>>,
 Assert<Equal<typeof callbackValue,typeof object>>,
 Assert<Equal<typeof mapValues,(number|string)[]>>,
 Assert<Equal<typeof mapPromises,Promise<42>[]>>,
 Assert<Equal<ReturnType<typeof specialized>,Promise<42>>>,
 Assert<Equal<Parameters<typeof specialized>,[token:'promise']>>
];
export function concreteK<K extends 'a'|'b'>(key:K & ([K] extends [string]?unknown:TokenMember<R,K>)):Provided<R>[K]{return bag.resolve<K>(key);}
export function genericSelection<R extends Registrations,K extends (keyof R&string)|TokenBase>(bag:Bag<R>,key:K & ([K] extends [string]?unknown:TokenMember<R,K>)):Provided<R>[SelectionKey<K>&keyof R]{return bag.resolve<K>(key);}
export function genericNoInfer<R extends Registrations,K extends (keyof R&string)|TokenBase>(bag:Bag<NoInfer<R>>,key:K & ([K] extends [string]?unknown:TokenMember<R,K>)):Provided<R>[SelectionKey<K>&keyof R]{return bag.resolve<K>(key);}
export function inferredSelection<R extends Registrations,K extends (keyof R&string)|TokenBase>(bag:Bag<R>,key:K & ([K] extends [string]?unknown:TokenMember<R,K>)){return bag.resolve<K>(key);}
export function genericValue<T>(bag:Bag<{a:()=>T}>):T{return bag.resolve('a');}
export function genericReflected<R extends Registrations>(resolve:Bag<R>['resolve']):Bag<R>['resolve']{return resolve;}
export function genericWiden<R extends Registrations>(bag:Bag<R>):Bag<R>{return bag;}
export const concreteBag:Bag<{a:()=>number}>=DiBag.begin().add({a:()=>1}).end();
export const tokenKey=Symbol('number');
export const numberToken=DiBag.token(tokenKey).of<number>();
export const promisedKey=Symbol('promised');
export const promiseToken=DiBag.token(promisedKey).of<Promise<42>>();
export const tokenBag=DiBag.begin().bind(numberToken,()=>1).bind(promiseToken,()=>Promise.resolve(42 as const)).end();
export const tokenValue:number=tokenBag.resolve(numberToken);
export const tokenPromise:Promise<42>=tokenBag.resolve(promiseToken);
const mismatched=DiBag.token(tokenKey).of<string|number>();
const missingKey=Symbol('missing');
const missingToken=DiBag.token(missingKey).of<number>();
declare const unionToken:typeof numberToken|typeof promiseToken;
declare const erased:TokenBase;
// @ts-expect-error Selected token service must match the retained invariant contract.
const wrongInvariant:number|string=tokenBag.resolve(mismatched);
// @ts-expect-error Expected output cannot manufacture a missing token binding.
const missing:number=tokenBag.resolve(missingToken);
// @ts-expect-error Union handles cannot select an individually known token contract.
const unionTokenValue:number|Promise<42>=tokenBag.resolve(unionToken);
// @ts-expect-error An erased handle does not prove the original binding contract.
const erasedValue:number=tokenBag.resolve(erased);
// @ts-expect-error Return context cannot make the numeric service a string.
const wrongReturn:string=tokenBag.resolve(numberToken);
// @ts-expect-error Return context cannot narrow a union key to just one service.
const wrongUnion:number=bag.resolve(unionKey);
// @ts-expect-error Missing names stay rejected despite a compatible expected result.
const missingNamed:number=bag.resolve('missing');
