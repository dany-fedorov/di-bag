import { DiBag } from '../src';
import type { Builder } from '../src/di-bag';
import type { DisposableFactory,Factory,Registration } from '../src/registration';
import type { CheckedConstraints, NeedConstraint } from '../src/module-types';
import type { TokenBase } from '../src/tokens';
import type { Entry, EntryKeys, From, Merge, ReplacementKeyOf, ReplacementOutput } from '../src/types';
import type { BuilderReplacementRegistration, ReplacementAdmission, ReplacedEntries, ZeroDependencyAdmission } from '../src/replacement-types';
type Equal<A,B>=(<T>()=>T extends A?1:2) extends (<T>()=>T extends B?1:2)?true:false;
type Assert<T extends true>=T;
export type OldReplace<E extends Entry,C extends NeedConstraint>={
 <const K extends string,V extends ((this:void)=>ReplacementOutput<NoInfer<From<E>>,K,C>)|DisposableFactory<(this:void)=>ReplacementOutput<NoInfer<From<E>>,K,C>>>(key:K&ReplacementKeyOf<EntryKeys<E>,K>,registration:V&(Factory|DisposableFactory<Factory>)&ZeroDependencyAdmission<NoInfer<V>>&CheckedConstraints<C,Merge<From<E>,Record<K,NoInfer<V>>>>):Builder<Exclude<E,{key:K}>|{key:K;registration:V},C>;
 <const K extends string|TokenBase,V extends Registration>(key:K&NoInfer<ReplacementAdmission<From<E>,K>>,registration:V&Registration&BuilderReplacementRegistration<E,C,NoInfer<K>,V>):Builder<ReplacedEntries<E,K,V>,C>;
};
export type GenericOverloads<E extends Entry,C extends NeedConstraint>=Assert<Equal<Builder<E,C>['replace'],OldReplace<E,C>>>;
export function oldToNew<E extends Entry,C extends NeedConstraint>(value:OldReplace<E,C>):Builder<E,C>['replace']{return value;}
export function newToOld<E extends Entry,C extends NeedConstraint>(value:Builder<E,C>['replace']):OldReplace<E,C>{return value;}
export const base=DiBag.begin().add({value:()=>({read:(n:number)=>n}),consumer:({value}:{value:{read(n:number):number}})=>value.read(1)});
export const extracted=base.replace;
export const extractedResult=extracted('value',()=>({read(n){return n+1;},richer(){return true;}})).end().resolve('value');
export const specialized=base.replace<'value',()=>{read(n:number):number;extra:'exact'}>;
export const specializedResult=specialized('value',()=>({read:n=>n+1,extra:'exact'})).end().resolve('value');
export const nested=base.replace('value',()=>({read(n){const x:number=n;return x+2;},nested:{call(n:number){return n;}}})).end().resolve('value');
export const genericForward=<F extends ()=>{read(n:number):number}>(f:F)=>base.replace<'value',F>('value',f);
export const inlineThis=base.replace('value',function(this:void){return {read(n){return n+3;},additional(){return 'yes' as const;}};}).end().resolve('value');
export const disposable=DiBag.begin().add({value:()=>0}).replace('value',DiBag.withDisposal(()=>({read(){return 3;},extra:'owned' as const}),v=>{const x:'owned'=v.extra;})).end().resolve('value');
export const promised=DiBag.begin().add({value:()=>0}).replace('value',async()=>({read(){return 3;},extra:'async' as const})).end().resolve('value');
export const rawProvider=DiBag.fromTokens([],()=>Promise.resolve(42 as const),{acquisition:'raw'});
export const nativeProvider=DiBag.fromTokens([],()=>Promise.resolve(42 as const),{acquisition:'native'});
export const decorated=DiBag.withAcquisitionMetadata(DiBag.withMetadata(rawProvider,{tag:'retained' as const}),v=>({raw:v}));
export const decoratedBag=DiBag.begin().add({value:()=>0}).replace('value',decorated).end();
export const decoratedValue=decoratedBag.resolve('value');
export const decoratedInspection=decoratedBag.inspect('value');
export const nativeValue=DiBag.begin().add({value:()=>0}).replace('value',nativeProvider).end().resolve('value');
export const tokenKey=Symbol('replacement');export const token=DiBag.token(tokenKey).of<{read(n:number):number}>();
export const tokenValue=DiBag.begin().bind(token,()=>({read:(n:number)=>n})).replace(token,()=>({read:(n:number)=>n+1,extra:'token' as const})).end().resolve(token);
export const dependency=DiBag.begin().add({value:()=>0,dep:()=>2}).replace('value',({dep}:{dep:number})=>({read(){return dep;},extra(){return true;}})).end().resolve('value');
export const optionalDependency=DiBag.begin().add({value:()=>0,dep:()=>2}).replace('value',(deps?:{dep:number})=>({read(){return deps?.dep;},extra(){return true;}})).end().resolve('value');
export const modulePrivate=DiBag.module().add({consumer:({value}:{value:{read(n:number):number}})=>value.read(1)}).exports(['consumer']);
export const privateValue=DiBag.begin().install(modulePrivate).add({value:()=>({read:(n:number)=>n})}).replace('value',()=>({read(n){return n+1;},extra:'private' as const})).end().resolve('value');
export type Exact=[
 Assert<Equal<typeof extractedResult,{read(n:number):number;richer():boolean}>>,
 Assert<Equal<typeof specializedResult,{read(n:number):number;extra:'exact'}>>,
 Assert<Equal<typeof decoratedValue,Promise<42>>>,Assert<Equal<typeof nativeValue,Promise<42>>>,
 Assert<Equal<typeof optionalDependency,{read():number|undefined;extra():boolean}>>
];
// @ts-expect-error Wrong contextual output remains checked.
base.replace('value',()=>({read(n){return String(n);}}));
// @ts-expect-error Required receiver is not accepted.
base.replace('value',function(this:{needed:number}){return {read:(n:number)=>n+this.needed};});
// @ts-expect-error The dependency-bearing path must reject wrong available needs.
DiBag.begin().add({value:()=>0,dep:()=>2}).replace('value',(deps?:{dep:string})=>deps?.dep);
// @ts-expect-error The private module constraint is still retained by replacement.
DiBag.begin().install(modulePrivate).add({value:()=>({read:(n:number)=>n})}).replace('value',()=>({read(n){return String(n);}}));
