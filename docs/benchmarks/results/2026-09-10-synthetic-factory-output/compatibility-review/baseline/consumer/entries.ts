import {builder,moduleBuilder,feature,factory,moduleFactory,token,tokenInstalled,tokenFeature,toOld,toNew,fromToOld,fromToNew} from '../dist/tests/entries-positive';
import {DiBag} from '../dist/src';
import type {Entries,From,Builder,ModuleBuilder} from '../dist/src';
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
