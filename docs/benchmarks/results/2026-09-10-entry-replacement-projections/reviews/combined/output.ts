import type { ReplacementOutput, Needs } from '../src/types';
import type { ReplacementOutput as LegacyOutput } from './legacy-types';
import type { Registrations, Registration } from '../src/registration';
import type { Provider } from '../src/provider';
type Equal<A,B>=(<T>()=>T extends A?1:2) extends (<T>()=>T extends B?1:2)?true:false;
type Assert<T extends true>=T;
declare const token:unique symbol;declare const other:unique symbol;
type Consumer<N extends object>=(deps:N)=>void;
type Maps=[
 never,any,{},Registrations,{value:()=>number},
 {value:()=>number;use:Consumer<{value:number}>},
 {value:()=>number;a:Consumer<{value:number}>;b:Consumer<{value:string}>},
 {value:()=>number;use:Consumer<{value:number|string}>},
 {value:()=>number;use:Consumer<{value?:number}>},
 {value:()=>number;use:Consumer<{value?:number|undefined}>},
 {value:()=>number;use?:Consumer<{value:number}>},
 {readonly value:()=>number;readonly use:Consumer<{readonly value:number}>},
 {[token]:()=>number;use:Consumer<{[token]:number}>},
 {0:()=>number;use:Consumer<{0:number}>},
 {value:()=>number;use:Consumer<{value:number}>|Consumer<{value:string}>},
 {value:()=>number;use:Consumer<{value:number}>}|{value:()=>string;use:Consumer<{value:string}>},
 {value:()=>number;first:Consumer<{value:number}>}|{value:()=>string;second:Consumer<{value:string}>},
 {value:()=>number;use:Registration},
 {value:()=>number;use:never},
 {value:()=>number;use:any},
 {value:()=>number;use:Provider<Consumer<{value:number}>>},
 {value:Consumer<{value:number}>},
 {[key:string]:Consumer<{value:number}>},
 {[key:number]:Consumer<{value:number}>},
 {[key:symbol]:Consumer<{value:number}>},
 {value:()=>number;use:Consumer<{value:number}>}&{other:Consumer<{value:string}>},
 {value:()=>number;use:Consumer<{value:never}>},
 {value:()=>number;use:Consumer<{value:any}>},
 {value:()=>number;use:Consumer<{value:unknown}>},
 {value:()=>number;use:Consumer<{value:number}>|Consumer<{other:string}>}
];
type Keys=[never,any,'value','use','missing','value'|'other',string,number,symbol,typeof token,0,PropertyKey];
type Constraints=[never,any,unknown,{readonly needs:{value:number}},{readonly needs:{value:string|number}},{readonly needs:{value?:number}},{readonly needs:{value:number}}|{readonly needs:{value:string}}, {readonly needs:{[token]:number}}];
import type { Entries,From } from "../src/types";
type LegacyEntries<R extends Registrations> = {[K in keyof R & (string|symbol)]:{key:K;registration:R[K]}}[keyof R & (string|symbol)];
export type ExactUnion=Assert<Equal<ReplacementOutput<Maps[7],'value'>,number|string>>;
export type ExactAcrossConsumers=Assert<Equal<ReplacementOutput<Maps[6],'value'>,never>>;
export type ExactOptional=Assert<Equal<ReplacementOutput<Maps[8],'value'>,number>>;
export type ExactExplicitUndefined=Assert<Equal<ReplacementOutput<Maps[9],'value'>,number|undefined>>;
export type ExactNoOldSelf=Assert<Equal<ReplacementOutput<Maps[21],'value'>,unknown>>;
export type ExactUnionValued=Assert<Equal<ReplacementOutput<Maps[14],"value">,number|string>>;
export type ExactUnionMap=Assert<Equal<ReplacementOutput<Maps[15],"value">,number|string>>;
export type ExactDistinctMapKeys=Assert<Equal<ReplacementOutput<Maps[16],"value">,unknown>>;
export type Case_0_0=Assert<Equal<ReplacementOutput<Maps[0],Keys[0]>,LegacyOutput<Maps[0],Keys[0]>>>;
export type Case_1_1=Assert<Equal<ReplacementOutput<Maps[1],Keys[1]>,LegacyOutput<Maps[1],Keys[1]>>>;
export type Case_10_2=Assert<Equal<ReplacementOutput<Maps[10],Keys[2]>,LegacyOutput<Maps[10],Keys[2]>>>;
export type Case_11_2=Assert<Equal<ReplacementOutput<Maps[11],Keys[2]>,LegacyOutput<Maps[11],Keys[2]>>>;
export type Case_12_9=Assert<Equal<ReplacementOutput<Maps[12],Keys[9]>,LegacyOutput<Maps[12],Keys[9]>>>;
export type Case_13_10=Assert<Equal<ReplacementOutput<Maps[13],Keys[10]>,LegacyOutput<Maps[13],Keys[10]>>>;
export type Case_14_2=Assert<Equal<ReplacementOutput<Maps[14],Keys[2]>,LegacyOutput<Maps[14],Keys[2]>>>;
export type Case_15_2=Assert<Equal<ReplacementOutput<Maps[15],Keys[2]>,LegacyOutput<Maps[15],Keys[2]>>>;
export type Case_16_2=Assert<Equal<ReplacementOutput<Maps[16],Keys[2]>,LegacyOutput<Maps[16],Keys[2]>>>;
export type Case_22_2=Assert<Equal<ReplacementOutput<Maps[22],Keys[2]>,LegacyOutput<Maps[22],Keys[2]>>>;
export type Case_23_2=Assert<Equal<ReplacementOutput<Maps[23],Keys[2]>,LegacyOutput<Maps[23],Keys[2]>>>;
export type Case_24_2=Assert<Equal<ReplacementOutput<Maps[24],Keys[2]>,LegacyOutput<Maps[24],Keys[2]>>>;
export type Retained_5_6=Assert<Equal<ReplacementOutput<Maps[5],"value",Constraints[6]>,LegacyOutput<Maps[5],"value",Constraints[6]>>>;
export type Retained_14_4=Assert<Equal<ReplacementOutput<Maps[14],"value",Constraints[4]>,LegacyOutput<Maps[14],"value",Constraints[4]>>>;
export type Retained_15_6=Assert<Equal<ReplacementOutput<Maps[15],"value",Constraints[6]>,LegacyOutput<Maps[15],"value",Constraints[6]>>>;
export type ThroughEntries_0=Assert<Equal<ReplacementOutput<From<Entries<Maps[0]>>,"value">,LegacyOutput<From<LegacyEntries<Maps[0]>>,"value">>>;
export type ThroughEntries_1=Assert<Equal<ReplacementOutput<From<Entries<Maps[1]>>,"value">,LegacyOutput<From<LegacyEntries<Maps[1]>>,"value">>>;
export type ThroughEntries_2=Assert<Equal<ReplacementOutput<From<Entries<Maps[2]>>,"value">,LegacyOutput<From<LegacyEntries<Maps[2]>>,"value">>>;
export type ThroughEntries_5=Assert<Equal<ReplacementOutput<From<Entries<Maps[5]>>,"value">,LegacyOutput<From<LegacyEntries<Maps[5]>>,"value">>>;
export type ThroughEntries_6=Assert<Equal<ReplacementOutput<From<Entries<Maps[6]>>,"value">,LegacyOutput<From<LegacyEntries<Maps[6]>>,"value">>>;
export type ThroughEntries_7=Assert<Equal<ReplacementOutput<From<Entries<Maps[7]>>,"value">,LegacyOutput<From<LegacyEntries<Maps[7]>>,"value">>>;
export type ThroughEntries_8=Assert<Equal<ReplacementOutput<From<Entries<Maps[8]>>,"value">,LegacyOutput<From<LegacyEntries<Maps[8]>>,"value">>>;
export type ThroughEntries_9=Assert<Equal<ReplacementOutput<From<Entries<Maps[9]>>,"value">,LegacyOutput<From<LegacyEntries<Maps[9]>>,"value">>>;
export type ThroughEntries_11=Assert<Equal<ReplacementOutput<From<Entries<Maps[11]>>,"value">,LegacyOutput<From<LegacyEntries<Maps[11]>>,"value">>>;
export type ThroughEntries_12=Assert<Equal<ReplacementOutput<From<Entries<Maps[12]>>,"value">,LegacyOutput<From<LegacyEntries<Maps[12]>>,"value">>>;
export type ThroughEntries_13=Assert<Equal<ReplacementOutput<From<Entries<Maps[13]>>,"value">,LegacyOutput<From<LegacyEntries<Maps[13]>>,"value">>>;
export type ThroughEntries_14=Assert<Equal<ReplacementOutput<From<Entries<Maps[14]>>,"value">,LegacyOutput<From<LegacyEntries<Maps[14]>>,"value">>>;
export type ThroughEntries_15=Assert<Equal<ReplacementOutput<From<Entries<Maps[15]>>,"value">,LegacyOutput<From<LegacyEntries<Maps[15]>>,"value">>>;
export type ThroughEntries_16=Assert<Equal<ReplacementOutput<From<Entries<Maps[16]>>,"value">,LegacyOutput<From<LegacyEntries<Maps[16]>>,"value">>>;
export type ThroughEntries_20=Assert<Equal<ReplacementOutput<From<Entries<Maps[20]>>,"value">,LegacyOutput<From<LegacyEntries<Maps[20]>>,"value">>>;
export type ThroughEntries_22=Assert<Equal<ReplacementOutput<From<Entries<Maps[22]>>,"value">,LegacyOutput<From<LegacyEntries<Maps[22]>>,"value">>>;
export type ThroughEntries_23=Assert<Equal<ReplacementOutput<From<Entries<Maps[23]>>,"value">,LegacyOutput<From<LegacyEntries<Maps[23]>>,"value">>>;
export type ThroughEntries_24=Assert<Equal<ReplacementOutput<From<Entries<Maps[24]>>,"value">,LegacyOutput<From<LegacyEntries<Maps[24]>>,"value">>>;
export type ThroughEntries_25=Assert<Equal<ReplacementOutput<From<Entries<Maps[25]>>,"value">,LegacyOutput<From<LegacyEntries<Maps[25]>>,"value">>>;
export type ThroughEntries_29=Assert<Equal<ReplacementOutput<From<Entries<Maps[29]>>,"value">,LegacyOutput<From<LegacyEntries<Maps[29]>>,"value">>>;
