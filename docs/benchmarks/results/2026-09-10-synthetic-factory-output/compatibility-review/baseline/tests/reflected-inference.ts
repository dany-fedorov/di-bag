import type { Bag } from '../src';
type Equal<A,B>=(<T>()=>T extends A?1:2) extends (<T>()=>T extends B?1:2)?true:false;
type Assert<T extends true>=T;
type Output<T>=ReturnType<Bag<{a:()=>T}>['resolve']>;
declare function accept<T>(value:Output<T>):T;
declare function callback<T>(fn:()=>Output<T>):T;
declare function wrapped<T>(value:Promise<Output<T>>):T;
export const object=accept({kind:'object' as const});
export const number=accept(1 as const);
export const promise=accept(Promise.resolve(42 as const));
export const functionValue=accept((value:number)=>String(value));
export const callbackValue=callback(()=>({kind:'object' as const}));
export const wrappedValue=wrapped(Promise.resolve({kind:'object' as const}));
type Assertions=[
 Assert<Equal<typeof object,{kind:'object'}>>,
 Assert<Equal<typeof number,1>>,
 Assert<Equal<typeof promise,Promise<42>>>,
 Assert<Equal<typeof functionValue,(value:number)=>string>>,
 Assert<Equal<typeof callbackValue,{kind:'object'}>>,
 Assert<Equal<typeof wrappedValue,{kind:'object'}>>
];
