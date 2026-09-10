import type { ContributionConstraint } from '../src/contribution-types';
import { DiBag } from '../src';
import type { Entries,From,Provided,Builder,ModuleBuilder,Registration } from '../src';
import type { Registrations } from '../src/registration';
import type { NeedConstraint } from '../src/module-types';
type Equal<A,B>=(<T>()=>T extends A?1:2) extends (<T>()=>T extends B?1:2)?true:false;
type Assert<T extends true>=T;
export type Legacy<R extends Registrations> = {[K in keyof R & (string|symbol)]:{key:K;registration:R[K]}}[keyof R & (string|symbol)];
export type GenericEquality<R extends Registrations>=Assert<Equal<Entries<R>,Legacy<R>>>;
export type GenericFrom<R extends Registrations>=Assert<Equal<From<Entries<R>>,From<Legacy<R>>>>;
export type GenericBuilder<R extends Registrations,C extends NeedConstraint>=Assert<Equal<Builder<Entries<R>,C>,Builder<Legacy<R>,C>>>;
export type GenericModule<R extends Registrations,C extends ContributionConstraint>=Assert<Equal<ModuleBuilder<Entries<R>,C>,ModuleBuilder<Legacy<R>,C>>>;
export function toOld<R extends Registrations>(x:Entries<R>):Legacy<R>{return x;}
export function toNew<R extends Registrations>(x:Legacy<R>):Entries<R>{return x;}
export function fromToOld<R extends Registrations>(x:From<Entries<R>>):From<Legacy<R>>{return x;}
export function fromToNew<R extends Registrations>(x:From<Legacy<R>>):From<Entries<R>>{return x;}
export function builderToOld<R extends Registrations,C extends NeedConstraint>(x:Builder<Entries<R>,C>):Builder<Legacy<R>,C>{return x;}
export function builderToNew<R extends Registrations,C extends NeedConstraint>(x:Builder<Legacy<R>,C>):Builder<Entries<R>,C>{return x;}
export function moduleToOld<R extends Registrations,C extends ContributionConstraint>(x:ModuleBuilder<Entries<R>,C>):ModuleBuilder<Legacy<R>,C>{return x;}
export function moduleToNew<R extends Registrations,C extends ContributionConstraint>(x:ModuleBuilder<Legacy<R>,C>):ModuleBuilder<Entries<R>,C>{return x;}
export function wrap<K extends string|symbol,V extends Registration>(key:K,value:V):Entries<Record<K,V>>{return {key,registration:value};}
export function unwrap<K extends string|symbol,V extends Registration>(entry:Entries<Record<K,V>>):{key:K;registration:V}{return entry;}
export function passThrough<K extends string|symbol,V extends Registration>(value:Entries<Record<K,V>>):Legacy<Record<K,V>>{return value;}
export function passBack<K extends string|symbol,V extends Registration>(value:Legacy<Record<K,V>>):Entries<Record<K,V>>{return value;}
export function passBuilder<K extends string|symbol,V extends Registration,C extends NeedConstraint>(builder:Builder<Entries<Record<K,V>>,C>):Builder<Legacy<Record<K,V>>,C>{return builder;}
export function passModule<K extends string|symbol,V extends Registration,C extends ContributionConstraint>(builder:ModuleBuilder<Entries<Record<K,V>>,C>):ModuleBuilder<Legacy<Record<K,V>>,C>{return builder;}
export const entry=wrap('value',()=>42 as const);
export const entryKey=Symbol('entry');export const symbolEntry=wrap(entryKey,()=>42 as const);
export const registrations={value:()=>1,use:({value}:{value:number})=>value+1};
export const all=DiBag.begin().add(registrations);
export const each=DiBag.begin().add({value:registrations.value}).add({use:registrations.use});
export const moduleAll=DiBag.module().add(registrations);
export const moduleEach=DiBag.module().add({value:registrations.value}).add({use:registrations.use});
export type ConcreteWrappers=[Assert<Equal<typeof all,typeof each>>,Assert<Equal<typeof moduleAll,typeof moduleEach>>];
