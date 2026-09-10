import { DiBag } from '../dist/src';
import type { Provider, ProviderFactory, ProviderOutput, ProviderAcquired } from '../dist/src/provider';
import { fromTokens } from '../dist/src/provider';
import type { TokenGraph } from '../dist/src/token-types';
import type { PublicProvider } from '../dist/src/module-types';
import { deferredFactory, deferredBack, deferredToOld, publicToOld, publicFromOld, publicModuleToOld, publicModuleFromOld, literal, raw, metadata, acquisition, extracted, extract, specialized, feature, outputToken, numberToken, installed, references, genericProvider, overloadedProvider } from '../dist/tests/factories';
type Equal<A,B>=(<T>()=>T extends A?1:2) extends (<T>()=>T extends B?1:2)?true:false;
type Assert<T extends true>=T;
export const inferred=deferredFactory(()=>({kind:'consumer' as const}));
export const roundTrip=deferredBack<()=>42>(deferredToOld<()=>42>(literal));
export const fromExtracted=extract([numberToken],number=>({number}));
export const fromSpecialized=specialized([numberToken],number=>'special');
export const fresh=DiBag.begin().install(feature).end();
export const output=fresh.resolve(outputToken);
export const plain=fresh.resolve('plain');
export const promise=fresh.resolve('raw');
export const structured=fresh.resolve('metadata');
export const acquired=fresh.resolve('acquisition');
export function freshGeneric<T>(value:T):Provider<()=>T,Readonly<{}>,readonly [],TokenGraph<readonly []>,Awaited<T>>{return fromTokens<readonly [],()=>T>([],()=>value);}
export function comparePublic<T>(value:PublicProvider<()=>T>):PublicProvider<()=>T>{return publicFromOld<()=>T>(publicToOld<()=>T>(value));}
export type Exact=[
 Assert<Equal<ProviderFactory<typeof inferred>,()=>{kind:'consumer'}>>,
 Assert<Equal<ProviderOutput<typeof roundTrip>,42>>,
 Assert<Equal<ProviderOutput<typeof fromExtracted>,{number:number}>>,
 Assert<Equal<ProviderOutput<typeof fromSpecialized>,'special'>>,
 Assert<Equal<typeof output,{value:number}>>,
 Assert<Equal<typeof plain,42>>,
 Assert<Equal<typeof promise,Promise<42>>>,
 Assert<Equal<typeof structured,{number:number;promise:Promise<42>}>>,
 Assert<Equal<typeof acquired,Promise<42>>>,
 Assert<Equal<ProviderAcquired<PublicProvider<typeof raw>>,Promise<42>>>,
 Assert<Equal<ProviderOutput<typeof overloadedProvider>,{kind:'last'}>>,
 Assert<Equal<ProviderOutput<typeof genericProvider>,unknown>>
];
// @ts-expect-error Emitted Provider keeps its invariant value contract.
const wrongInvariant:Provider<()=>number>=literal;
// @ts-expect-error Emitted declarations preserve callback input admission.
const wrongCallback=extract([numberToken],(value:string)=>value);
// @ts-expect-error The installed service is a promise.
const wrongPromise:42=promise;
