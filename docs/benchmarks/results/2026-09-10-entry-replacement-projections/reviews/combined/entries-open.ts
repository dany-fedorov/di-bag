import { DiBag } from '../src';
import type { Entries,From,Provided,Builder,ModuleBuilder,Registration,Provider } from '../src';
import type { Entry } from '../src/types';
import type { Registrations } from '../src/registration';
type Equal<A,B>=(<T>()=>T extends A?1:2) extends (<T>()=>T extends B?1:2)?true:false;
type Assert<T extends true>=T;
type Legacy<R extends Registrations> = {[K in keyof R & (string|symbol)]:{key:K;registration:R[K]}}[keyof R & (string|symbol)];
declare const s:unique symbol;
type R={a:()=>1;b:()=>string;readonly c:Provider<()=>Promise<42>>;[s]:()=>true};
type Union={a:()=>1;b:()=>2}|{a:()=>3;c:()=>4};
type Optional={readonly a?:()=>number;b:()=>string};
type Indexed=Record<string,()=>number>;
type Template={[K in `prefix:${string}`]:()=>number};
type Symbolic={[K:symbol]:()=>number};
type Numeric={0:()=>number;'1':()=>string};
type ExactCases=[
 Assert<Equal<Entries<R>,Legacy<R>>>,
 Assert<Equal<Entries<Union>,Legacy<Union>>>,
 Assert<Equal<Entries<Optional>,Legacy<Optional>>>,
 Assert<Equal<Entries<Indexed>,Legacy<Indexed>>>,
 Assert<Equal<Entries<Template>,Legacy<Template>>>,
 Assert<Equal<Entries<Symbolic>,Legacy<Symbolic>>>,
 Assert<Equal<Entries<Numeric>,Legacy<Numeric>>>,
 Assert<Equal<Entries<any>,Legacy<any>>>,
 Assert<Equal<Entries<never>,Legacy<never>>>,
 Assert<Equal<Entries<{}>,Legacy<{}>>>,
 Assert<Equal<Entries<{a:any;b:never}>,Legacy<{a:any;b:never}>>>,
 Assert<Equal<Entries<NoInfer<R>>,Legacy<NoInfer<R>>>>,
 Assert<Equal<From<Entries<R>>,From<Legacy<R>>>>,
 Assert<Equal<From<Entries<Union>>,From<Legacy<Union>>>>,
 Assert<Equal<From<Entries<Indexed>>,From<Legacy<Indexed>>>>,
 Assert<Equal<From<Entries<Template>>,From<Legacy<Template>>>>,
 Assert<Equal<From<Entries<Symbolic>>,From<Legacy<Symbolic>>>>,
 Assert<Equal<From<Entries<any>>,From<Legacy<any>>>>,
 Assert<Equal<From<Entries<never>>,From<Legacy<never>>>>
];
export function toOld<R extends Registrations>(value:Entries<R>):Legacy<R>{return value;}
export function toNew<R extends Registrations>(value:Legacy<R>):Entries<R>{return value;}
export function fromToOld<R extends Registrations>(value:From<Entries<R>>):From<Legacy<R>>{return value;}
export function fromToNew<R extends Registrations>(value:From<Legacy<R>>):From<Entries<R>>{return value;}
export function oldBuilder<R extends Registrations>(value:Builder<Entries<R>>):Builder<Legacy<R>>{return value;}
export function newBuilder<R extends Registrations>(value:Builder<Legacy<R>>):Builder<Entries<R>>{return value;}
export function oldModule<R extends Registrations>(value:ModuleBuilder<Entries<R>>):ModuleBuilder<Legacy<R>>{return value;}
export function newModule<R extends Registrations>(value:ModuleBuilder<Legacy<R>>):ModuleBuilder<Entries<R>>{return value;}
export function noInferOld<R extends Registrations>(value:Entries<NoInfer<R>>):Legacy<R>{return value;}
export function noInferNew<R extends Registrations>(value:Legacy<NoInfer<R>>):Entries<R>{return value;}
export function deferred<K extends string|symbol,V extends Registration>(value:Entries<Record<K,V>>):Legacy<Record<K,V>>{return value;}
export function deferredBack<K extends string|symbol,V extends Registration>(value:Legacy<Record<K,V>>):Entries<Record<K,V>>{return value;}
declare function inferMap<R extends Registrations>(value:Entries<R>):R;
declare function inferOldMap<R extends Registrations>(value:Legacy<R>):R;
declare const entry:Entries<R>;
export const inferred=inferMap(entry);
export const inferredOld=inferOldMap(entry);
type Inference=Assert<Equal<typeof inferred,typeof inferredOld>>;
export const registrations={a:()=>1,b:({a}:{a:number})=>String(a)};
export const builder=DiBag.begin().add(registrations);
export const individual=DiBag.begin().add({a:registrations.a}).add({b:registrations.b});
export const same:typeof builder=individual;
export const reverse:typeof individual=builder;
export const moduleBuilder=DiBag.module().add(registrations);
export const moduleIndividual=DiBag.module().add({a:registrations.a}).add({b:registrations.b});
export const moduleSame:typeof moduleBuilder=moduleIndividual;
export const moduleReverse:typeof moduleIndividual=moduleBuilder;
export const moduleView:ReturnType<typeof moduleBuilder.replace>=moduleBuilder;
export const feature=moduleView.exports(['a','b']);
export const installed=DiBag.begin().install(feature);
export const finalized=installed.end();
export const result=finalized.resolve('b');
type Projected=typeof builder extends Builder<infer E extends Entry,infer C>?Provided<From<E>>:never;
type ProjectedExact=Assert<Equal<Projected,{a:number;b:string}>>;
type ResultExact=Assert<Equal<typeof result,string>>;
export const factory=()=>builder.replace('a',()=>2);
export const moduleFactory=()=>moduleBuilder.replace('a',()=>2);
export const valueKey=Symbol('value');
export const token=DiBag.token(valueKey).of<{value:number}>();
export const tokenFeature=DiBag.module().bind(token,()=>({value:1})).exports([token]);
export const tokenInstalled=DiBag.begin().install(tokenFeature);
export const tokenResult=tokenInstalled.end().resolve(token);
type TokenResultExact=Assert<Equal<typeof tokenResult,{value:number}>>;
