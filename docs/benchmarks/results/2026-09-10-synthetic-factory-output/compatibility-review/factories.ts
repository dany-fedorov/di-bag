import { DiBag } from '../src';
import { fromTokens, withMetadata, withAcquisitionMetadata } from '../src/provider';
import { optional, lazy, all } from '../src/dependency-references';
import type { Dependency } from '../src/dependency-references';
import type { Provider, ProviderFactory, ProviderOutput, ProviderAcquired, ProviderNeeds, ProviderMetadata, ProviderGraph } from '../src/provider';
import type { TokenBase } from '../src/tokens';
import type { TokenArguments, TokenTupleAdmission, DependencyTupleAdmission, TokenGraph, ReferenceGraph } from '../src/token-types';
import type { AcquisitionMode, Acquired, StageOptions } from '../src/acquisition-mode';
import type { Registration, Registrations } from '../src/registration';
import type { PublicProvider, PublicProviders, ModulePublicProviders } from '../src/module-types';
import type { PublicProvider as LegacyPublicProvider, PublicProviders as LegacyPublicProviders, ModulePublicProviders as LegacyModulePublicProviders } from './legacy-module-types';

type Equal<A,B>=(<T>()=>T extends A?1:2) extends (<T>()=>T extends B?1:2)?true:false;
type Assert<T extends true>=T;
type Old<F extends (...args:any[])=>any,T extends readonly TokenBase[]=readonly [],M extends AcquisitionMode='auto'>=Provider<()=>ReturnType<F>,Readonly<{}>,readonly [],TokenGraph<T>,Acquired<ReturnType<F>,M>>;
type Reflected<T>=ReturnType<typeof fromTokens<readonly [],()=>T>>;

export function deferredFactory<F extends ()=>unknown>(callback:F):Old<F>{return fromTokens<readonly [],F>([],callback);}
export function deferredBack<F extends ()=>unknown>(provider:Old<F>):ReturnType<typeof fromTokens<readonly [],F>>{return provider;}
export function deferredToOld<F extends ()=>unknown>(provider:ReturnType<typeof fromTokens<readonly [],F>>):Old<F>{return provider;}
export function deferredOutput<F extends ()=>unknown>(value:ProviderFactory<ReturnType<typeof fromTokens<readonly [],F>>>):()=>ReturnType<F>{return value;}
export function deferredOutputBack<F extends ()=>unknown>(value:()=>ReturnType<F>):ProviderFactory<ReturnType<typeof fromTokens<readonly [],F>>>{return value;}
export function deferredValue<T>(value:ProviderOutput<Reflected<T>>):T{return value;}
export function deferredValueBack<T>(value:T):ProviderOutput<Reflected<T>>{return value;}
export function deferredMode<F extends ()=>('native' extends M?Promise<unknown>:unknown),M extends AcquisitionMode>(callback:F,...options:StageOptions<M>):Old<F,readonly [],M>{return fromTokens<readonly [],F,M>([],callback,...options);}
export function deferredTokens<T extends readonly TokenBase[],F extends (this:void,...args:TokenArguments<NoInfer<T>>)=>unknown>(tokens:T&TokenTupleAdmission<T>,callback:F):Provider<()=>ReturnType<F>,Readonly<{}>,readonly [],ReferenceGraph<T>,Awaited<ReturnType<F>>>{return fromTokens<T,F>(tokens,callback);}
export function deferredRefs<T extends readonly Dependency[],F extends (this:void,...args:TokenArguments<NoInfer<T>>)=>unknown>(tokens:T&DependencyTupleAdmission<T>,callback:F):Provider<()=>ReturnType<F>,Readonly<{}>,readonly [],ReferenceGraph<T>,Awaited<ReturnType<F>>>{return fromTokens<T,F>(tokens,callback);}
export function publicToOld<R extends Registration>(value:PublicProvider<R>):LegacyPublicProvider<R>{return value;}
export function publicFromOld<R extends Registration>(value:LegacyPublicProvider<R>):PublicProvider<R>{return value;}
export function publicMapToOld<R extends object>(value:PublicProviders<R>):LegacyPublicProviders<R>{return value;}
export function publicMapFromOld<R extends object>(value:LegacyPublicProviders<R>):PublicProviders<R>{return value;}
export function publicModuleToOld<R extends Registrations,K extends keyof R>(value:ModulePublicProviders<R,K>):LegacyModulePublicProviders<R,K>{return value;}
export function publicModuleFromOld<R extends Registrations,K extends keyof R>(value:LegacyModulePublicProviders<R,K>):ModulePublicProviders<R,K>{return value;}

declare function inferReflected<T>(value:ProviderOutput<Reflected<T>>):T;
declare function inferFactory<T>(value:ProviderFactory<Reflected<T>>):T;
declare function inferProvider<T>(value:Reflected<T>):T;
declare function inferPublic<T>(value:PublicProvider<()=>T>):T;
declare function inferPublicOutput<T>(value:ProviderOutput<PublicProvider<()=>T>>):T;
export const inferredLiteral=inferReflected(1 as const);
export const inferredObject=inferReflected({kind:'value' as const});
export const inferredPromise=inferReflected(Promise.resolve(42 as const));
export const inferredFunction=inferFactory(()=>({kind:'callback' as const}));
export const inferredFromProvider=inferProvider(fromTokens([],()=>({kind:'provider' as const})));
export const inferredFromPublic=inferPublic(()=>({kind:'public' as const}));
export const inferredFromPublicOutput=inferPublicOutput({kind:'public-output' as const});

export const numberKey=Symbol('number');
export const numberToken=DiBag.token(numberKey).of<number>();
export const promiseKey=Symbol('promise');
export const promiseToken=DiBag.token(promiseKey).of<Promise<42>>();
export const outputKey=Symbol('output');
export const outputToken=DiBag.token(outputKey).of<{value:number}>();
export const literal=fromTokens([],()=>42 as const);
export const promised=fromTokens([],()=>Promise.resolve(42 as const));
export const raw=fromTokens([],()=>Promise.resolve(42 as const),{acquisition:'raw'});
export const native=fromTokens([],()=>Promise.resolve(42 as const),{acquisition:'native'});
export const functional=fromTokens([],()=>((value:number)=>String(value)));
export const anyOutput=fromTokens([],():any=>0);
export const neverOutput=fromTokens([],():never=>{throw new Error('unreachable');});
export const unknownOutput=fromTokens([],():unknown=>0);
export const contextual=fromTokens([numberToken,promiseToken],(number,promise)=>({number,promise}));
export const references=fromTokens([numberToken,optional(promiseToken),lazy(numberToken),all(numberToken)],(number,promise,lazyNumber,numbers)=>({number,promise,lazyNumber,numbers}));
declare function overloaded():{kind:'zero'};
declare function overloaded(value?:number):{kind:'last'};
export const overloadedProvider=fromTokens([],overloaded);
export const genericProvider=fromTokens([],<T>(value?:T)=>value);
export const extract=fromTokens;
export const extracted=extract([numberToken],value=>({value}));
export const specialized=fromTokens<readonly [typeof numberToken],(value:number)=>'special'>;
export const specializedResult=specialized([numberToken],value=>'special');
export const metadata=withMetadata(contextual,{tag:'test' as const});
export const acquisition=withAcquisitionMetadata(raw,value=>({value}));
export const feature=DiBag.module().bind(numberToken,()=>1).bind(promiseToken,()=>Promise.resolve(42 as const)).bind(outputToken,extracted).add({plain:literal,raw,metadata,acquisition}).exports([outputToken,'plain','raw','metadata','acquisition']);
export const installed=DiBag.begin().install(feature).end();
export const installedOutput=installed.resolve(outputToken);
export const installedPlain=installed.resolve('plain');
export const installedRaw=installed.resolve('raw');
export const installedMetadata=installed.resolve('metadata');
export const installedAcquisition=installed.resolve('acquisition');

export type EqualityChecks=[
 Assert<Equal<typeof literal,Old<()=>42>>>,
 Assert<Equal<ProviderFactory<typeof literal>,()=>42>>,
 Assert<Equal<ProviderOutput<typeof raw>,Promise<42>>>,
 Assert<Equal<ProviderAcquired<typeof raw>,Promise<42>>>,
 Assert<Equal<ProviderAcquired<typeof native>,42>>,
 Assert<Equal<ProviderAcquired<typeof promised>,42>>,
 Assert<Equal<ProviderOutput<typeof functional>,(value:number)=>string>>,
 Assert<Equal<ProviderOutput<typeof anyOutput>,any>>,
 Assert<Equal<ProviderOutput<typeof neverOutput>,never>>,
 Assert<Equal<ProviderOutput<typeof unknownOutput>,unknown>>,
 Assert<Equal<ProviderOutput<typeof overloadedProvider>,{kind:'last'}>>,
 Assert<Equal<ProviderOutput<typeof genericProvider>,unknown>>,
 Assert<Equal<ProviderOutput<typeof references>,{number:number;promise:Promise<42>|undefined;lazyNumber:()=>number;numbers:readonly number[]}>>,
 Assert<Equal<ReturnType<typeof specialized>,Old<(value:number)=>'special',readonly [typeof numberToken]>>>,
 Assert<Equal<ProviderOutput<typeof specializedResult>,'special'>>,
 Assert<Equal<PublicProvider<typeof literal>,()=>42>>,
 Assert<Equal<PublicProvider<typeof raw>,LegacyPublicProvider<typeof raw>>>,
 Assert<Equal<PublicProvider<typeof metadata>,LegacyPublicProvider<typeof metadata>>>,
 Assert<Equal<PublicProvider<typeof acquisition>,LegacyPublicProvider<typeof acquisition>>>,
 Assert<Equal<PublicProvider<any>,LegacyPublicProvider<any>>>,
 Assert<Equal<PublicProvider<never>,LegacyPublicProvider<never>>>,
 Assert<Equal<PublicProvider<typeof anyOutput>,LegacyPublicProvider<typeof anyOutput>>>,
 Assert<Equal<PublicProvider<typeof neverOutput>,LegacyPublicProvider<typeof neverOutput>>>,
 Assert<Equal<PublicProvider<typeof literal|typeof raw>,LegacyPublicProvider<typeof literal|typeof raw>>>,
 Assert<Equal<PublicProvider<NoInfer<typeof literal>>,LegacyPublicProvider<NoInfer<typeof literal>>>>,
 Assert<Equal<ProviderNeeds<PublicProvider<typeof metadata>>,Record<never,never>>>,
 Assert<Equal<ProviderMetadata<PublicProvider<typeof metadata>>,ProviderMetadata<typeof metadata>&object>>,
 Assert<Equal<ProviderAcquired<PublicProvider<typeof raw>>,Promise<42>>>,
 Assert<Equal<typeof installedOutput,{value:number}>>,
 Assert<Equal<typeof installedPlain,42>>,
 Assert<Equal<typeof installedRaw,Promise<42>>>,
 Assert<Equal<typeof installedMetadata,{number:number;promise:Promise<42>}>>,
 Assert<Equal<typeof installedAcquisition,Promise<42>>>,
 Assert<Equal<typeof inferredLiteral,1>>,
 Assert<Equal<typeof inferredObject,{kind:'value'}>>,
 Assert<Equal<typeof inferredPromise,Promise<42>>>,
 Assert<Equal<typeof inferredFunction,{kind:'callback'}>>,
 Assert<Equal<typeof inferredFromProvider,{kind:'provider'}>>,
 Assert<Equal<typeof inferredFromPublic,{kind:'public'}>>,
 Assert<Equal<typeof inferredFromPublicOutput,unknown>>
];
// @ts-expect-error Provider output remains invariant.
const wrongProvider:Provider<()=>number>=literal;
// @ts-expect-error Native acquisition requires a Promise.
const wrongNative=fromTokens([],()=>1,{acquisition:'native'});
// @ts-expect-error Selected token controls callback input.
const wrongArgument=fromTokens([numberToken],(value:string)=>value);
// @ts-expect-error The callback cannot require a receiver.
const wrongReceiver=fromTokens([],function(this:{x:number}){return this.x;});

export function deferredReflectedTokens<T extends readonly TokenBase[],F extends (this:void,...args:TokenArguments<NoInfer<T>>)=>unknown>(value:ReturnType<typeof fromTokens<T,F>>):Old<F,T>{return value;}
export function deferredReflectedTokensBack<T extends readonly TokenBase[],F extends (this:void,...args:TokenArguments<NoInfer<T>>)=>unknown>(value:Old<F,T>):ReturnType<typeof fromTokens<T,F>>{return value;}
