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
export type OpenAll<R extends Registrations,K extends PropertyKey,C>=Assert<Equal<ReplacementOutput<R,K,C>,LegacyOutput<R,K,C>>>;
export function allToOld<R extends Registrations,K extends PropertyKey,C>(x:ReplacementOutput<R,K,C>):LegacyOutput<R,K,C>{return x;}
export function allFromOld<R extends Registrations,K extends PropertyKey,C>(x:LegacyOutput<R,K,C>):ReplacementOutput<R,K,C>{return x;}
export type OpenKey_0<K extends PropertyKey>=Assert<Equal<ReplacementOutput<Maps[0],K>,LegacyOutput<Maps[0],K>>>;
export function keyToOld_0<K extends PropertyKey>(x:ReplacementOutput<Maps[0],K>):LegacyOutput<Maps[0],K>{return x;}
export function keyFromOld_0<K extends PropertyKey>(x:LegacyOutput<Maps[0],K>):ReplacementOutput<Maps[0],K>{return x;}
export type OpenKey_1<K extends PropertyKey>=Assert<Equal<ReplacementOutput<Maps[1],K>,LegacyOutput<Maps[1],K>>>;
export function keyToOld_1<K extends PropertyKey>(x:ReplacementOutput<Maps[1],K>):LegacyOutput<Maps[1],K>{return x;}
export function keyFromOld_1<K extends PropertyKey>(x:LegacyOutput<Maps[1],K>):ReplacementOutput<Maps[1],K>{return x;}
export type OpenKey_2<K extends PropertyKey>=Assert<Equal<ReplacementOutput<Maps[2],K>,LegacyOutput<Maps[2],K>>>;
export function keyToOld_2<K extends PropertyKey>(x:ReplacementOutput<Maps[2],K>):LegacyOutput<Maps[2],K>{return x;}
export function keyFromOld_2<K extends PropertyKey>(x:LegacyOutput<Maps[2],K>):ReplacementOutput<Maps[2],K>{return x;}
export type OpenKey_3<K extends PropertyKey>=Assert<Equal<ReplacementOutput<Maps[3],K>,LegacyOutput<Maps[3],K>>>;
export function keyToOld_3<K extends PropertyKey>(x:ReplacementOutput<Maps[3],K>):LegacyOutput<Maps[3],K>{return x;}
export function keyFromOld_3<K extends PropertyKey>(x:LegacyOutput<Maps[3],K>):ReplacementOutput<Maps[3],K>{return x;}
export type OpenKey_4<K extends PropertyKey>=Assert<Equal<ReplacementOutput<Maps[4],K>,LegacyOutput<Maps[4],K>>>;
export function keyToOld_4<K extends PropertyKey>(x:ReplacementOutput<Maps[4],K>):LegacyOutput<Maps[4],K>{return x;}
export function keyFromOld_4<K extends PropertyKey>(x:LegacyOutput<Maps[4],K>):ReplacementOutput<Maps[4],K>{return x;}
export type OpenKey_5<K extends PropertyKey>=Assert<Equal<ReplacementOutput<Maps[5],K>,LegacyOutput<Maps[5],K>>>;
export function keyToOld_5<K extends PropertyKey>(x:ReplacementOutput<Maps[5],K>):LegacyOutput<Maps[5],K>{return x;}
export function keyFromOld_5<K extends PropertyKey>(x:LegacyOutput<Maps[5],K>):ReplacementOutput<Maps[5],K>{return x;}
export type OpenKey_6<K extends PropertyKey>=Assert<Equal<ReplacementOutput<Maps[6],K>,LegacyOutput<Maps[6],K>>>;
export function keyToOld_6<K extends PropertyKey>(x:ReplacementOutput<Maps[6],K>):LegacyOutput<Maps[6],K>{return x;}
export function keyFromOld_6<K extends PropertyKey>(x:LegacyOutput<Maps[6],K>):ReplacementOutput<Maps[6],K>{return x;}
export type OpenKey_7<K extends PropertyKey>=Assert<Equal<ReplacementOutput<Maps[7],K>,LegacyOutput<Maps[7],K>>>;
export function keyToOld_7<K extends PropertyKey>(x:ReplacementOutput<Maps[7],K>):LegacyOutput<Maps[7],K>{return x;}
export function keyFromOld_7<K extends PropertyKey>(x:LegacyOutput<Maps[7],K>):ReplacementOutput<Maps[7],K>{return x;}
export type OpenKey_8<K extends PropertyKey>=Assert<Equal<ReplacementOutput<Maps[8],K>,LegacyOutput<Maps[8],K>>>;
export function keyToOld_8<K extends PropertyKey>(x:ReplacementOutput<Maps[8],K>):LegacyOutput<Maps[8],K>{return x;}
export function keyFromOld_8<K extends PropertyKey>(x:LegacyOutput<Maps[8],K>):ReplacementOutput<Maps[8],K>{return x;}
export type OpenKey_9<K extends PropertyKey>=Assert<Equal<ReplacementOutput<Maps[9],K>,LegacyOutput<Maps[9],K>>>;
export function keyToOld_9<K extends PropertyKey>(x:ReplacementOutput<Maps[9],K>):LegacyOutput<Maps[9],K>{return x;}
export function keyFromOld_9<K extends PropertyKey>(x:LegacyOutput<Maps[9],K>):ReplacementOutput<Maps[9],K>{return x;}
export type OpenKey_10<K extends PropertyKey>=Assert<Equal<ReplacementOutput<Maps[10],K>,LegacyOutput<Maps[10],K>>>;
export function keyToOld_10<K extends PropertyKey>(x:ReplacementOutput<Maps[10],K>):LegacyOutput<Maps[10],K>{return x;}
export function keyFromOld_10<K extends PropertyKey>(x:LegacyOutput<Maps[10],K>):ReplacementOutput<Maps[10],K>{return x;}
export type OpenKey_11<K extends PropertyKey>=Assert<Equal<ReplacementOutput<Maps[11],K>,LegacyOutput<Maps[11],K>>>;
export function keyToOld_11<K extends PropertyKey>(x:ReplacementOutput<Maps[11],K>):LegacyOutput<Maps[11],K>{return x;}
export function keyFromOld_11<K extends PropertyKey>(x:LegacyOutput<Maps[11],K>):ReplacementOutput<Maps[11],K>{return x;}
export type OpenKey_12<K extends PropertyKey>=Assert<Equal<ReplacementOutput<Maps[12],K>,LegacyOutput<Maps[12],K>>>;
export function keyToOld_12<K extends PropertyKey>(x:ReplacementOutput<Maps[12],K>):LegacyOutput<Maps[12],K>{return x;}
export function keyFromOld_12<K extends PropertyKey>(x:LegacyOutput<Maps[12],K>):ReplacementOutput<Maps[12],K>{return x;}
export type OpenKey_13<K extends PropertyKey>=Assert<Equal<ReplacementOutput<Maps[13],K>,LegacyOutput<Maps[13],K>>>;
export function keyToOld_13<K extends PropertyKey>(x:ReplacementOutput<Maps[13],K>):LegacyOutput<Maps[13],K>{return x;}
export function keyFromOld_13<K extends PropertyKey>(x:LegacyOutput<Maps[13],K>):ReplacementOutput<Maps[13],K>{return x;}
export type OpenKey_14<K extends PropertyKey>=Assert<Equal<ReplacementOutput<Maps[14],K>,LegacyOutput<Maps[14],K>>>;
export function keyToOld_14<K extends PropertyKey>(x:ReplacementOutput<Maps[14],K>):LegacyOutput<Maps[14],K>{return x;}
export function keyFromOld_14<K extends PropertyKey>(x:LegacyOutput<Maps[14],K>):ReplacementOutput<Maps[14],K>{return x;}
export type OpenKey_15<K extends PropertyKey>=Assert<Equal<ReplacementOutput<Maps[15],K>,LegacyOutput<Maps[15],K>>>;
export function keyToOld_15<K extends PropertyKey>(x:ReplacementOutput<Maps[15],K>):LegacyOutput<Maps[15],K>{return x;}
export function keyFromOld_15<K extends PropertyKey>(x:LegacyOutput<Maps[15],K>):ReplacementOutput<Maps[15],K>{return x;}
export type OpenKey_16<K extends PropertyKey>=Assert<Equal<ReplacementOutput<Maps[16],K>,LegacyOutput<Maps[16],K>>>;
export function keyToOld_16<K extends PropertyKey>(x:ReplacementOutput<Maps[16],K>):LegacyOutput<Maps[16],K>{return x;}
export function keyFromOld_16<K extends PropertyKey>(x:LegacyOutput<Maps[16],K>):ReplacementOutput<Maps[16],K>{return x;}
export type OpenKey_17<K extends PropertyKey>=Assert<Equal<ReplacementOutput<Maps[17],K>,LegacyOutput<Maps[17],K>>>;
export function keyToOld_17<K extends PropertyKey>(x:ReplacementOutput<Maps[17],K>):LegacyOutput<Maps[17],K>{return x;}
export function keyFromOld_17<K extends PropertyKey>(x:LegacyOutput<Maps[17],K>):ReplacementOutput<Maps[17],K>{return x;}
export type OpenKey_18<K extends PropertyKey>=Assert<Equal<ReplacementOutput<Maps[18],K>,LegacyOutput<Maps[18],K>>>;
export function keyToOld_18<K extends PropertyKey>(x:ReplacementOutput<Maps[18],K>):LegacyOutput<Maps[18],K>{return x;}
export function keyFromOld_18<K extends PropertyKey>(x:LegacyOutput<Maps[18],K>):ReplacementOutput<Maps[18],K>{return x;}
export type OpenKey_19<K extends PropertyKey>=Assert<Equal<ReplacementOutput<Maps[19],K>,LegacyOutput<Maps[19],K>>>;
export function keyToOld_19<K extends PropertyKey>(x:ReplacementOutput<Maps[19],K>):LegacyOutput<Maps[19],K>{return x;}
export function keyFromOld_19<K extends PropertyKey>(x:LegacyOutput<Maps[19],K>):ReplacementOutput<Maps[19],K>{return x;}
export type OpenKey_20<K extends PropertyKey>=Assert<Equal<ReplacementOutput<Maps[20],K>,LegacyOutput<Maps[20],K>>>;
export function keyToOld_20<K extends PropertyKey>(x:ReplacementOutput<Maps[20],K>):LegacyOutput<Maps[20],K>{return x;}
export function keyFromOld_20<K extends PropertyKey>(x:LegacyOutput<Maps[20],K>):ReplacementOutput<Maps[20],K>{return x;}
export type OpenKey_21<K extends PropertyKey>=Assert<Equal<ReplacementOutput<Maps[21],K>,LegacyOutput<Maps[21],K>>>;
export function keyToOld_21<K extends PropertyKey>(x:ReplacementOutput<Maps[21],K>):LegacyOutput<Maps[21],K>{return x;}
export function keyFromOld_21<K extends PropertyKey>(x:LegacyOutput<Maps[21],K>):ReplacementOutput<Maps[21],K>{return x;}
export type OpenKey_22<K extends PropertyKey>=Assert<Equal<ReplacementOutput<Maps[22],K>,LegacyOutput<Maps[22],K>>>;
export function keyToOld_22<K extends PropertyKey>(x:ReplacementOutput<Maps[22],K>):LegacyOutput<Maps[22],K>{return x;}
export function keyFromOld_22<K extends PropertyKey>(x:LegacyOutput<Maps[22],K>):ReplacementOutput<Maps[22],K>{return x;}
export type OpenKey_23<K extends PropertyKey>=Assert<Equal<ReplacementOutput<Maps[23],K>,LegacyOutput<Maps[23],K>>>;
export function keyToOld_23<K extends PropertyKey>(x:ReplacementOutput<Maps[23],K>):LegacyOutput<Maps[23],K>{return x;}
export function keyFromOld_23<K extends PropertyKey>(x:LegacyOutput<Maps[23],K>):ReplacementOutput<Maps[23],K>{return x;}
export type OpenKey_24<K extends PropertyKey>=Assert<Equal<ReplacementOutput<Maps[24],K>,LegacyOutput<Maps[24],K>>>;
export function keyToOld_24<K extends PropertyKey>(x:ReplacementOutput<Maps[24],K>):LegacyOutput<Maps[24],K>{return x;}
export function keyFromOld_24<K extends PropertyKey>(x:LegacyOutput<Maps[24],K>):ReplacementOutput<Maps[24],K>{return x;}
export type OpenKey_25<K extends PropertyKey>=Assert<Equal<ReplacementOutput<Maps[25],K>,LegacyOutput<Maps[25],K>>>;
export function keyToOld_25<K extends PropertyKey>(x:ReplacementOutput<Maps[25],K>):LegacyOutput<Maps[25],K>{return x;}
export function keyFromOld_25<K extends PropertyKey>(x:LegacyOutput<Maps[25],K>):ReplacementOutput<Maps[25],K>{return x;}
export type OpenKey_26<K extends PropertyKey>=Assert<Equal<ReplacementOutput<Maps[26],K>,LegacyOutput<Maps[26],K>>>;
export function keyToOld_26<K extends PropertyKey>(x:ReplacementOutput<Maps[26],K>):LegacyOutput<Maps[26],K>{return x;}
export function keyFromOld_26<K extends PropertyKey>(x:LegacyOutput<Maps[26],K>):ReplacementOutput<Maps[26],K>{return x;}
export type OpenKey_27<K extends PropertyKey>=Assert<Equal<ReplacementOutput<Maps[27],K>,LegacyOutput<Maps[27],K>>>;
export function keyToOld_27<K extends PropertyKey>(x:ReplacementOutput<Maps[27],K>):LegacyOutput<Maps[27],K>{return x;}
export function keyFromOld_27<K extends PropertyKey>(x:LegacyOutput<Maps[27],K>):ReplacementOutput<Maps[27],K>{return x;}
export type OpenKey_28<K extends PropertyKey>=Assert<Equal<ReplacementOutput<Maps[28],K>,LegacyOutput<Maps[28],K>>>;
export function keyToOld_28<K extends PropertyKey>(x:ReplacementOutput<Maps[28],K>):LegacyOutput<Maps[28],K>{return x;}
export function keyFromOld_28<K extends PropertyKey>(x:LegacyOutput<Maps[28],K>):ReplacementOutput<Maps[28],K>{return x;}
export type OpenKey_29<K extends PropertyKey>=Assert<Equal<ReplacementOutput<Maps[29],K>,LegacyOutput<Maps[29],K>>>;
export function keyToOld_29<K extends PropertyKey>(x:ReplacementOutput<Maps[29],K>):LegacyOutput<Maps[29],K>{return x;}
export function keyFromOld_29<K extends PropertyKey>(x:LegacyOutput<Maps[29],K>):ReplacementOutput<Maps[29],K>{return x;}
export type OpenMap_0<R extends Registrations>=Assert<Equal<ReplacementOutput<R,Keys[0]>,LegacyOutput<R,Keys[0]>>>;
export function mapToOld_0<R extends Registrations>(x:ReplacementOutput<R,Keys[0]>):LegacyOutput<R,Keys[0]>{return x;}
export function mapFromOld_0<R extends Registrations>(x:LegacyOutput<R,Keys[0]>):ReplacementOutput<R,Keys[0]>{return x;}
export type OpenMap_1<R extends Registrations>=Assert<Equal<ReplacementOutput<R,Keys[1]>,LegacyOutput<R,Keys[1]>>>;
export function mapToOld_1<R extends Registrations>(x:ReplacementOutput<R,Keys[1]>):LegacyOutput<R,Keys[1]>{return x;}
export function mapFromOld_1<R extends Registrations>(x:LegacyOutput<R,Keys[1]>):ReplacementOutput<R,Keys[1]>{return x;}
export type OpenMap_2<R extends Registrations>=Assert<Equal<ReplacementOutput<R,Keys[2]>,LegacyOutput<R,Keys[2]>>>;
export function mapToOld_2<R extends Registrations>(x:ReplacementOutput<R,Keys[2]>):LegacyOutput<R,Keys[2]>{return x;}
export function mapFromOld_2<R extends Registrations>(x:LegacyOutput<R,Keys[2]>):ReplacementOutput<R,Keys[2]>{return x;}
export type OpenMap_3<R extends Registrations>=Assert<Equal<ReplacementOutput<R,Keys[3]>,LegacyOutput<R,Keys[3]>>>;
export function mapToOld_3<R extends Registrations>(x:ReplacementOutput<R,Keys[3]>):LegacyOutput<R,Keys[3]>{return x;}
export function mapFromOld_3<R extends Registrations>(x:LegacyOutput<R,Keys[3]>):ReplacementOutput<R,Keys[3]>{return x;}
export type OpenMap_4<R extends Registrations>=Assert<Equal<ReplacementOutput<R,Keys[4]>,LegacyOutput<R,Keys[4]>>>;
export function mapToOld_4<R extends Registrations>(x:ReplacementOutput<R,Keys[4]>):LegacyOutput<R,Keys[4]>{return x;}
export function mapFromOld_4<R extends Registrations>(x:LegacyOutput<R,Keys[4]>):ReplacementOutput<R,Keys[4]>{return x;}
export type OpenMap_5<R extends Registrations>=Assert<Equal<ReplacementOutput<R,Keys[5]>,LegacyOutput<R,Keys[5]>>>;
export function mapToOld_5<R extends Registrations>(x:ReplacementOutput<R,Keys[5]>):LegacyOutput<R,Keys[5]>{return x;}
export function mapFromOld_5<R extends Registrations>(x:LegacyOutput<R,Keys[5]>):ReplacementOutput<R,Keys[5]>{return x;}
export type OpenMap_6<R extends Registrations>=Assert<Equal<ReplacementOutput<R,Keys[6]>,LegacyOutput<R,Keys[6]>>>;
export function mapToOld_6<R extends Registrations>(x:ReplacementOutput<R,Keys[6]>):LegacyOutput<R,Keys[6]>{return x;}
export function mapFromOld_6<R extends Registrations>(x:LegacyOutput<R,Keys[6]>):ReplacementOutput<R,Keys[6]>{return x;}
export type OpenMap_7<R extends Registrations>=Assert<Equal<ReplacementOutput<R,Keys[7]>,LegacyOutput<R,Keys[7]>>>;
export function mapToOld_7<R extends Registrations>(x:ReplacementOutput<R,Keys[7]>):LegacyOutput<R,Keys[7]>{return x;}
export function mapFromOld_7<R extends Registrations>(x:LegacyOutput<R,Keys[7]>):ReplacementOutput<R,Keys[7]>{return x;}
export type OpenMap_8<R extends Registrations>=Assert<Equal<ReplacementOutput<R,Keys[8]>,LegacyOutput<R,Keys[8]>>>;
export function mapToOld_8<R extends Registrations>(x:ReplacementOutput<R,Keys[8]>):LegacyOutput<R,Keys[8]>{return x;}
export function mapFromOld_8<R extends Registrations>(x:LegacyOutput<R,Keys[8]>):ReplacementOutput<R,Keys[8]>{return x;}
export type OpenMap_9<R extends Registrations>=Assert<Equal<ReplacementOutput<R,Keys[9]>,LegacyOutput<R,Keys[9]>>>;
export function mapToOld_9<R extends Registrations>(x:ReplacementOutput<R,Keys[9]>):LegacyOutput<R,Keys[9]>{return x;}
export function mapFromOld_9<R extends Registrations>(x:LegacyOutput<R,Keys[9]>):ReplacementOutput<R,Keys[9]>{return x;}
export type OpenMap_10<R extends Registrations>=Assert<Equal<ReplacementOutput<R,Keys[10]>,LegacyOutput<R,Keys[10]>>>;
export function mapToOld_10<R extends Registrations>(x:ReplacementOutput<R,Keys[10]>):LegacyOutput<R,Keys[10]>{return x;}
export function mapFromOld_10<R extends Registrations>(x:LegacyOutput<R,Keys[10]>):ReplacementOutput<R,Keys[10]>{return x;}
export type OpenMap_11<R extends Registrations>=Assert<Equal<ReplacementOutput<R,Keys[11]>,LegacyOutput<R,Keys[11]>>>;
export function mapToOld_11<R extends Registrations>(x:ReplacementOutput<R,Keys[11]>):LegacyOutput<R,Keys[11]>{return x;}
export function mapFromOld_11<R extends Registrations>(x:LegacyOutput<R,Keys[11]>):ReplacementOutput<R,Keys[11]>{return x;}
export type OpenWithConstraints_0<R extends Registrations,K extends PropertyKey>=Assert<Equal<ReplacementOutput<R,K,Constraints[0]>,LegacyOutput<R,K,Constraints[0]>>>;
export type OpenWithConstraints_1<R extends Registrations,K extends PropertyKey>=Assert<Equal<ReplacementOutput<R,K,Constraints[1]>,LegacyOutput<R,K,Constraints[1]>>>;
export type OpenWithConstraints_2<R extends Registrations,K extends PropertyKey>=Assert<Equal<ReplacementOutput<R,K,Constraints[2]>,LegacyOutput<R,K,Constraints[2]>>>;
export type OpenWithConstraints_3<R extends Registrations,K extends PropertyKey>=Assert<Equal<ReplacementOutput<R,K,Constraints[3]>,LegacyOutput<R,K,Constraints[3]>>>;
export type OpenWithConstraints_4<R extends Registrations,K extends PropertyKey>=Assert<Equal<ReplacementOutput<R,K,Constraints[4]>,LegacyOutput<R,K,Constraints[4]>>>;
export type OpenWithConstraints_5<R extends Registrations,K extends PropertyKey>=Assert<Equal<ReplacementOutput<R,K,Constraints[5]>,LegacyOutput<R,K,Constraints[5]>>>;
export type OpenWithConstraints_6<R extends Registrations,K extends PropertyKey>=Assert<Equal<ReplacementOutput<R,K,Constraints[6]>,LegacyOutput<R,K,Constraints[6]>>>;
export type OpenWithConstraints_7<R extends Registrations,K extends PropertyKey>=Assert<Equal<ReplacementOutput<R,K,Constraints[7]>,LegacyOutput<R,K,Constraints[7]>>>;
export type OpenConstraints_0<C>=Assert<Equal<ReplacementOutput<Maps[0],"value",C>,LegacyOutput<Maps[0],"value",C>>>;
export type OpenConstraints_1<C>=Assert<Equal<ReplacementOutput<Maps[1],"value",C>,LegacyOutput<Maps[1],"value",C>>>;
export type OpenConstraints_2<C>=Assert<Equal<ReplacementOutput<Maps[2],"value",C>,LegacyOutput<Maps[2],"value",C>>>;
export type OpenConstraints_3<C>=Assert<Equal<ReplacementOutput<Maps[3],"value",C>,LegacyOutput<Maps[3],"value",C>>>;
export type OpenConstraints_4<C>=Assert<Equal<ReplacementOutput<Maps[4],"value",C>,LegacyOutput<Maps[4],"value",C>>>;
export type OpenConstraints_5<C>=Assert<Equal<ReplacementOutput<Maps[5],"value",C>,LegacyOutput<Maps[5],"value",C>>>;
export type OpenConstraints_6<C>=Assert<Equal<ReplacementOutput<Maps[6],"value",C>,LegacyOutput<Maps[6],"value",C>>>;
export type OpenConstraints_7<C>=Assert<Equal<ReplacementOutput<Maps[7],"value",C>,LegacyOutput<Maps[7],"value",C>>>;
export type OpenConstraints_8<C>=Assert<Equal<ReplacementOutput<Maps[8],"value",C>,LegacyOutput<Maps[8],"value",C>>>;
export type OpenConstraints_9<C>=Assert<Equal<ReplacementOutput<Maps[9],"value",C>,LegacyOutput<Maps[9],"value",C>>>;
export type OpenConstraints_10<C>=Assert<Equal<ReplacementOutput<Maps[10],"value",C>,LegacyOutput<Maps[10],"value",C>>>;
export type OpenConstraints_11<C>=Assert<Equal<ReplacementOutput<Maps[11],"value",C>,LegacyOutput<Maps[11],"value",C>>>;
export type OpenConstraints_12<C>=Assert<Equal<ReplacementOutput<Maps[12],"value",C>,LegacyOutput<Maps[12],"value",C>>>;
export type OpenConstraints_13<C>=Assert<Equal<ReplacementOutput<Maps[13],"value",C>,LegacyOutput<Maps[13],"value",C>>>;
export type OpenConstraints_14<C>=Assert<Equal<ReplacementOutput<Maps[14],"value",C>,LegacyOutput<Maps[14],"value",C>>>;
export type OpenConstraints_15<C>=Assert<Equal<ReplacementOutput<Maps[15],"value",C>,LegacyOutput<Maps[15],"value",C>>>;
export type OpenConstraints_16<C>=Assert<Equal<ReplacementOutput<Maps[16],"value",C>,LegacyOutput<Maps[16],"value",C>>>;
export type OpenConstraints_17<C>=Assert<Equal<ReplacementOutput<Maps[17],"value",C>,LegacyOutput<Maps[17],"value",C>>>;
export type OpenConstraints_18<C>=Assert<Equal<ReplacementOutput<Maps[18],"value",C>,LegacyOutput<Maps[18],"value",C>>>;
export type OpenConstraints_19<C>=Assert<Equal<ReplacementOutput<Maps[19],"value",C>,LegacyOutput<Maps[19],"value",C>>>;
export type OpenConstraints_20<C>=Assert<Equal<ReplacementOutput<Maps[20],"value",C>,LegacyOutput<Maps[20],"value",C>>>;
export type OpenConstraints_21<C>=Assert<Equal<ReplacementOutput<Maps[21],"value",C>,LegacyOutput<Maps[21],"value",C>>>;
export type OpenConstraints_22<C>=Assert<Equal<ReplacementOutput<Maps[22],"value",C>,LegacyOutput<Maps[22],"value",C>>>;
export type OpenConstraints_23<C>=Assert<Equal<ReplacementOutput<Maps[23],"value",C>,LegacyOutput<Maps[23],"value",C>>>;
export type OpenConstraints_24<C>=Assert<Equal<ReplacementOutput<Maps[24],"value",C>,LegacyOutput<Maps[24],"value",C>>>;
export type OpenConstraints_25<C>=Assert<Equal<ReplacementOutput<Maps[25],"value",C>,LegacyOutput<Maps[25],"value",C>>>;
export type OpenConstraints_26<C>=Assert<Equal<ReplacementOutput<Maps[26],"value",C>,LegacyOutput<Maps[26],"value",C>>>;
export type OpenConstraints_27<C>=Assert<Equal<ReplacementOutput<Maps[27],"value",C>,LegacyOutput<Maps[27],"value",C>>>;
export type OpenConstraints_28<C>=Assert<Equal<ReplacementOutput<Maps[28],"value",C>,LegacyOutput<Maps[28],"value",C>>>;
export type OpenConstraints_29<C>=Assert<Equal<ReplacementOutput<Maps[29],"value",C>,LegacyOutput<Maps[29],"value",C>>>;
