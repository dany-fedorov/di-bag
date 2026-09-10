import {makeEntry,makeNamed,makeSymbol,wrapEntry} from './dist-KIND/review/entry-construction';
import {install,installEmpty,installInferred,module as wrappedFeature} from './dist-KIND/review/install-wrappers';
import {wrap,unwrap,passThrough,passBack,passBuilder,passModule} from './dist-KIND/review/generic-entries-positive';
import {inferredFactory,inferredObject,inferredPromise,inferredCallback,inferredNamed,inferredSymbol,inferredUnionKey,tokenKey,selected} from './dist-KIND/review/entry-inference';
import {builder,moduleBuilder,feature,factory,moduleFactory,token,tokenInstalled,tokenFeature,toOld,toNew,fromToOld,fromToNew} from './dist-KIND/review/entries-positive';
import {DiBag} from './dist-KIND/src';
import type {Entries,From,Builder,ModuleBuilder} from './dist-KIND/src';
type Equal<A,B>=(<T>()=>T extends A?1:2) extends (<T>()=>T extends B?1:2)?true:false;
type Assert<T extends true>=T;
export const named=builder.add({flag:()=>true}).end();
export const namedValue=named.resolve('b');
export const flag=named.resolve('flag');
export const replaced=factory().end().resolve('a');
export const installed=DiBag.begin().install(feature).end().resolve('b');
export const replacedModule=DiBag.begin().install(moduleFactory().exports(['a','b'])).end().resolve('a');
export const tokenValue=tokenInstalled.end().resolve(token);
export const freshTokenValue=DiBag.begin().install(tokenFeature).end().resolve(token);
export const reflected:ReturnType<typeof moduleBuilder.replace>=moduleBuilder;
export const reflectedValue=DiBag.begin().install(reflected.exports(['b'])).add({a:()=>1}).end().resolve('b');
type R={a:()=>number;b:()=>string};
declare const entries:Parameters<typeof toOld>[0];
export const roundTrip=toNew(toOld(entries));
declare const mapped:Parameters<typeof fromToOld>[0];
export const mappedRoundTrip=fromToNew(fromToOld(mapped));
type Exact=[
 Assert<Equal<typeof namedValue,string>>,
 Assert<Equal<typeof flag,boolean>>,
 Assert<Equal<typeof replaced,number>>,
 Assert<Equal<typeof installed,string>>,
 Assert<Equal<typeof replacedModule,number>>,
 Assert<Equal<typeof tokenValue,{value:number}>>,
 Assert<Equal<typeof freshTokenValue,{value:number}>>,
 Assert<Equal<typeof reflectedValue,string>>,
 Assert<Equal<typeof roundTrip,typeof entries>>,
 Assert<Equal<typeof mappedRoundTrip,typeof mapped>>
];

export const made=makeEntry('fresh',()=>42 as const);
export const createdKey=Symbol('created');
export const madeSymbol=makeSymbol(createdKey,()=>42 as const);
export const entryRoundTrip=unwrap(wrap('fresh',()=>42 as const));
export const genericRoundTrip=passBack(passThrough(made));
export const viaInstall=install(DiBag.begin(),wrappedFeature).end().resolve('value');
export const viaEmpty=installEmpty(DiBag.begin(),wrappedFeature).end().resolve('value');
export const viaInferred=installInferred(DiBag.begin(),wrappedFeature).end().resolve('value');
export type Supplemental=[
 Assert<Equal<typeof made,Entries<{fresh:()=>42}>>>,
 Assert<Equal<typeof madeSymbol,Entries<{[createdKey]:()=>42}>>>,
 Assert<Equal<typeof entryRoundTrip,{key:'fresh';registration:()=>42}>>,
 Assert<Equal<typeof genericRoundTrip,typeof made>>,
 Assert<Equal<typeof viaInstall,number>>,Assert<Equal<typeof viaEmpty,number>>,Assert<Equal<typeof viaInferred,number>>,
 Assert<Equal<ReturnType<typeof inferredFactory>,42>>,
 Assert<Equal<typeof inferredObject,{kind:'entry'}>>,Assert<Equal<typeof inferredPromise,Promise<42>>>,
 Assert<Equal<typeof inferredCallback,(n:number)=>string>>,
 Assert<Equal<typeof inferredNamed,'named'>>,Assert<Equal<typeof inferredSymbol,typeof tokenKey>>,
 Assert<Equal<typeof inferredUnionKey,'one'|'two'>>,
 Assert<Equal<typeof selected,{read():number;extra():'retained'}>>
];
// @ts-expect-error Numeric entry construction remains rejected.
makeEntry(42,()=>1);
