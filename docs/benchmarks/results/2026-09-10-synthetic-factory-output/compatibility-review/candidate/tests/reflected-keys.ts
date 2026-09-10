import type { Bag,Provided,TokenBase,TokenMember,SelectionKey } from '../src';
type Equal<A,B>=(<T>()=>T extends A?1:2) extends (<T>()=>T extends B?1:2)?true:false;
type Assert<T extends true>=T;
type Output<K extends string,T>=ReturnType<Bag<Record<K,()=>T>>['resolve']>;
declare function both<K extends string,T>(key:K,value:Output<K,T>):[K,T];
declare function callback<K extends string,T>(key:K,value:()=>Output<K,T>):[K,T];
declare function wrapped<K extends string,T>(key:K,value:Promise<Output<K,T>>):[K,T];
declare function fixed<T>(value:Output<'a'|'b',T>):T;
declare function optional<T>(value:ReturnType<Bag<{a?:()=>T}>['resolve']>):T;
declare function indexed<T>(value:ReturnType<Bag<Record<string,()=>T>>['resolve']>):T;
declare function union<T>(value:ReturnType<Bag<{a:()=>T}|{a:()=>T;b:()=>1}>['resolve']>):T;
declare const keySymbol:unique symbol;
declare function symbolic<T>(value:ReturnType<Bag<{[keySymbol]:()=>T}>['resolve']>):T;
export const pair=both('a',{kind:'object' as const});
export const callbackPair=callback('a',()=>({kind:'object' as const}));
export const wrappedPair=wrapped('a',Promise.resolve({kind:'object' as const}));
export const fixedValue=fixed({kind:'object' as const});
export const optionalValue=optional({kind:'object' as const});
export const indexedValue=indexed({kind:'object' as const});
export const unionValue=union({kind:'object' as const});
export const symbolicValue=symbolic({kind:'object' as const});
export function genericWrapper<T>(bag:Bag<{a:()=>T}>){return bag.resolve('a');}
declare function inferredWrapper<T>(value:ReturnType<typeof genericWrapper<T>>):T;
export const wrappedResult=inferredWrapper({kind:'object' as const});
type Assertions=[
 Assert<Equal<typeof pair,['a',{kind:'object'}]>>,
 Assert<Equal<typeof callbackPair,['a',{kind:'object'}]>>,
 Assert<Equal<typeof wrappedPair,['a',{kind:'object'}]>>,
 Assert<Equal<typeof fixedValue,{kind:'object'}>>,
 Assert<Equal<typeof optionalValue,{kind:'object'}>>,
 Assert<Equal<typeof indexedValue,{kind:'object'}>>,
 Assert<Equal<typeof unionValue,{kind:'object'}>>,
 Assert<Equal<typeof symbolicValue,{kind:'object'}>>,
 Assert<Equal<typeof wrappedResult,{kind:'object'}>>
];
