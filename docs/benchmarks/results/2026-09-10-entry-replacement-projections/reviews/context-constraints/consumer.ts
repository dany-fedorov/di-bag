import { DiBag } from './dist-KIND/src';
import type { Builder } from './dist-KIND/src/di-bag';
import type { CheckedConstraints, NeedConstraint } from './dist-KIND/src/module-types';
import type { Registrations } from './dist-KIND/src/registration';
import { base, extracted, specialized, extractedResult, specializedResult, nested, inlineThis, disposable, promised, decoratedValue, decoratedInspection, nativeValue, tokenValue, dependency, optionalDependency, privateValue, oldToNew, newToOld, type GenericOverloads, type OldReplace } from './dist-KIND/review/replacement';
import type { NeverC, Case_4_4, Case_4_5, Case_8_4, Case_0_0 } from './dist-KIND/review/constraints';
import { builder,moduleBuilder,result,forward } from './dist-KIND/tests/types/replacement-reflection';
import type { Entry } from './dist-KIND/src/types';
type Equal<A,B>=(<T>()=>T extends A?1:2) extends (<T>()=>T extends B?1:2)?true:false;type Assert<T extends true>=T;
export const fresh=extracted('value',()=>({read(n:number){return n+2;},extra:'consumer' as const})).end().resolve('value');
export const callSpecialized=specialized('value',()=>({read:(n:number)=>n,extra:'exact' as const})).end().resolve('value');
export const freshInline=DiBag.begin().add({value:()=>({read:()=>0}),consumer:({value}:{value:{read():number}})=>value.read()}).replace('value',()=>({read(){return 2;},extra(){return true;}})).end().resolve('value');
export function roundTrip<E extends Entry,C extends NeedConstraint>(x:Builder<E,C>['replace']):Builder<E,C>['replace']{return oldToNew<E,C>(newToOld<E,C>(x));}
export type Generic<E extends Entry,C extends NeedConstraint>=GenericOverloads<E,C>;
export type Unconstrained<A extends Registrations>=NeverC<A>;
export const forwarded=forward(()=>2).end().resolve('value');
export type Checks=[
 Assert<Equal<typeof fresh,{read(n:number):number;extra:'consumer'}>>,
 Assert<Equal<typeof callSpecialized,{read(n:number):number;extra:'exact'}>>,
 Assert<Equal<typeof freshInline,{read():number;extra():boolean}>>,
 Assert<Equal<typeof promised,Promise<{read():number;extra:'async'}>>>,
 Assert<Equal<typeof decoratedValue,Promise<42>>>,Assert<Equal<typeof nativeValue,Promise<42>>>,
 Assert<Equal<typeof dependency,{read():number;extra():true}>>,
 Assert<Equal<typeof optionalDependency,{read():number|undefined;extra():boolean}>>,
 Assert<Equal<typeof privateValue,{read(n:number):number;extra:'private'}>>,
 Assert<Equal<typeof result,number>>,Assert<Equal<typeof forwarded,number>>,
 Assert<Equal<Case_4_4,true>>,Assert<Equal<Case_4_5,true>>,Assert<Equal<Case_8_4,true>>,Assert<Equal<Case_0_0,true>>
];
// @ts-expect-error Wrong output remains rejected through the emitted extracted overloads.
extracted('value',()=>({read(){return 'wrong';}}));
// @ts-expect-error Exact output still includes the promise wrapper.
const wrongPromise:42=decoratedValue;
// @ts-expect-error Reflected builder must not erase dependency history.
const erased:ReturnType<typeof builder.replace>=builder;
// @ts-expect-error Missing callback dependency remains rejected after declaration emission.
DiBag.begin().add({value:()=>0}).replace('value',(deps?:{missing:number})=>deps?.missing).end();
