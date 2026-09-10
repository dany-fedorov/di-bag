import type { NeedConstraint, CheckedConstraints, CompleteConstraints, IncrementalConstraints } from '../src/module-types';
import type { CheckedConstraints as LegacyChecked, CompleteConstraints as LegacyComplete, IncrementalConstraints as LegacyIncremental } from './legacy-module-types';
import type { Registrations, Registration } from '../src/registration';
import type { Provider } from '../src/provider';
import type { Token } from '../src/tokens';
type Equal<A,B>=(<T>()=>T extends A?1:2) extends (<T>()=>T extends B?1:2)?true:false;
type Assert<T extends true>=T;
declare const key:unique symbol;
type Named<N extends object>={readonly kind:'export';readonly consumer:'consumer';readonly needs:N};
type External<N extends object>={readonly kind:'external';readonly consumer:typeof key;readonly needs:N};
type Constraints=[never,any,NeedConstraint,{kind:'opaque'},Named<{x:number}>,Named<{x?:number}>,Named<{readonly x:number}>,Named<{x:number|string}>,Named<{x:number}>|External<{x:string}>,Named<{0:number}>,Named<{[key]:number}>,Named<{}>,Named<{x:never}>,Named<{x:any}>,Named<{x:unknown}>,{kind:'token-external';consumer:'t';token:Token<typeof key,number>}];
type Maps=[never,any,{},Registrations,{x:()=>number},{x:()=>string},{x?:()=>number},{readonly x:()=>number},{0:()=>number},{[key]:()=>number},{x:(()=>number)|(()=>string)},{x:()=>number}|{x:()=>string},{x:()=>number}|{y:()=>string},{x:never},{x:any},{x:Registration},{x:Provider<()=>number>},{x:()=>Promise<number>},{x:()=>unknown},{[k:string]:()=>number},{x?:()=>undefined},{readonly x?:(()=>number)|(()=>string)}];
export type OpenMap_0<A extends Registrations>=Assert<Equal<CheckedConstraints<Constraints[0],A>,LegacyChecked<Constraints[0],A>>>;
export function toOldMap_0<A extends Registrations>(x:CheckedConstraints<Constraints[0],A>):LegacyChecked<Constraints[0],A>{return x;}
export function fromOldMap_0<A extends Registrations>(x:LegacyChecked<Constraints[0],A>):CheckedConstraints<Constraints[0],A>{return x;}
export type OpenMap_1<A extends Registrations>=Assert<Equal<CheckedConstraints<Constraints[1],A>,LegacyChecked<Constraints[1],A>>>;
export function toOldMap_1<A extends Registrations>(x:CheckedConstraints<Constraints[1],A>):LegacyChecked<Constraints[1],A>{return x;}
export function fromOldMap_1<A extends Registrations>(x:LegacyChecked<Constraints[1],A>):CheckedConstraints<Constraints[1],A>{return x;}
export type OpenMap_2<A extends Registrations>=Assert<Equal<CheckedConstraints<Constraints[2],A>,LegacyChecked<Constraints[2],A>>>;
export function toOldMap_2<A extends Registrations>(x:CheckedConstraints<Constraints[2],A>):LegacyChecked<Constraints[2],A>{return x;}
export function fromOldMap_2<A extends Registrations>(x:LegacyChecked<Constraints[2],A>):CheckedConstraints<Constraints[2],A>{return x;}
export type OpenMap_3<A extends Registrations>=Assert<Equal<CheckedConstraints<Constraints[3],A>,LegacyChecked<Constraints[3],A>>>;
export function toOldMap_3<A extends Registrations>(x:CheckedConstraints<Constraints[3],A>):LegacyChecked<Constraints[3],A>{return x;}
export function fromOldMap_3<A extends Registrations>(x:LegacyChecked<Constraints[3],A>):CheckedConstraints<Constraints[3],A>{return x;}
export type OpenMap_4<A extends Registrations>=Assert<Equal<CheckedConstraints<Constraints[4],A>,LegacyChecked<Constraints[4],A>>>;
export function toOldMap_4<A extends Registrations>(x:CheckedConstraints<Constraints[4],A>):LegacyChecked<Constraints[4],A>{return x;}
export function fromOldMap_4<A extends Registrations>(x:LegacyChecked<Constraints[4],A>):CheckedConstraints<Constraints[4],A>{return x;}
export type OpenMap_5<A extends Registrations>=Assert<Equal<CheckedConstraints<Constraints[5],A>,LegacyChecked<Constraints[5],A>>>;
export function toOldMap_5<A extends Registrations>(x:CheckedConstraints<Constraints[5],A>):LegacyChecked<Constraints[5],A>{return x;}
export function fromOldMap_5<A extends Registrations>(x:LegacyChecked<Constraints[5],A>):CheckedConstraints<Constraints[5],A>{return x;}
export type OpenMap_6<A extends Registrations>=Assert<Equal<CheckedConstraints<Constraints[6],A>,LegacyChecked<Constraints[6],A>>>;
export function toOldMap_6<A extends Registrations>(x:CheckedConstraints<Constraints[6],A>):LegacyChecked<Constraints[6],A>{return x;}
export function fromOldMap_6<A extends Registrations>(x:LegacyChecked<Constraints[6],A>):CheckedConstraints<Constraints[6],A>{return x;}
export type OpenMap_7<A extends Registrations>=Assert<Equal<CheckedConstraints<Constraints[7],A>,LegacyChecked<Constraints[7],A>>>;
export function toOldMap_7<A extends Registrations>(x:CheckedConstraints<Constraints[7],A>):LegacyChecked<Constraints[7],A>{return x;}
export function fromOldMap_7<A extends Registrations>(x:LegacyChecked<Constraints[7],A>):CheckedConstraints<Constraints[7],A>{return x;}
export type OpenMap_8<A extends Registrations>=Assert<Equal<CheckedConstraints<Constraints[8],A>,LegacyChecked<Constraints[8],A>>>;
export function toOldMap_8<A extends Registrations>(x:CheckedConstraints<Constraints[8],A>):LegacyChecked<Constraints[8],A>{return x;}
export function fromOldMap_8<A extends Registrations>(x:LegacyChecked<Constraints[8],A>):CheckedConstraints<Constraints[8],A>{return x;}
export type OpenMap_9<A extends Registrations>=Assert<Equal<CheckedConstraints<Constraints[9],A>,LegacyChecked<Constraints[9],A>>>;
export function toOldMap_9<A extends Registrations>(x:CheckedConstraints<Constraints[9],A>):LegacyChecked<Constraints[9],A>{return x;}
export function fromOldMap_9<A extends Registrations>(x:LegacyChecked<Constraints[9],A>):CheckedConstraints<Constraints[9],A>{return x;}
export type OpenMap_10<A extends Registrations>=Assert<Equal<CheckedConstraints<Constraints[10],A>,LegacyChecked<Constraints[10],A>>>;
export function toOldMap_10<A extends Registrations>(x:CheckedConstraints<Constraints[10],A>):LegacyChecked<Constraints[10],A>{return x;}
export function fromOldMap_10<A extends Registrations>(x:LegacyChecked<Constraints[10],A>):CheckedConstraints<Constraints[10],A>{return x;}
export type OpenMap_11<A extends Registrations>=Assert<Equal<CheckedConstraints<Constraints[11],A>,LegacyChecked<Constraints[11],A>>>;
export function toOldMap_11<A extends Registrations>(x:CheckedConstraints<Constraints[11],A>):LegacyChecked<Constraints[11],A>{return x;}
export function fromOldMap_11<A extends Registrations>(x:LegacyChecked<Constraints[11],A>):CheckedConstraints<Constraints[11],A>{return x;}
export type OpenMap_12<A extends Registrations>=Assert<Equal<CheckedConstraints<Constraints[12],A>,LegacyChecked<Constraints[12],A>>>;
export function toOldMap_12<A extends Registrations>(x:CheckedConstraints<Constraints[12],A>):LegacyChecked<Constraints[12],A>{return x;}
export function fromOldMap_12<A extends Registrations>(x:LegacyChecked<Constraints[12],A>):CheckedConstraints<Constraints[12],A>{return x;}
export type OpenMap_13<A extends Registrations>=Assert<Equal<CheckedConstraints<Constraints[13],A>,LegacyChecked<Constraints[13],A>>>;
export function toOldMap_13<A extends Registrations>(x:CheckedConstraints<Constraints[13],A>):LegacyChecked<Constraints[13],A>{return x;}
export function fromOldMap_13<A extends Registrations>(x:LegacyChecked<Constraints[13],A>):CheckedConstraints<Constraints[13],A>{return x;}
export type OpenMap_14<A extends Registrations>=Assert<Equal<CheckedConstraints<Constraints[14],A>,LegacyChecked<Constraints[14],A>>>;
export function toOldMap_14<A extends Registrations>(x:CheckedConstraints<Constraints[14],A>):LegacyChecked<Constraints[14],A>{return x;}
export function fromOldMap_14<A extends Registrations>(x:LegacyChecked<Constraints[14],A>):CheckedConstraints<Constraints[14],A>{return x;}
export type OpenMap_15<A extends Registrations>=Assert<Equal<CheckedConstraints<Constraints[15],A>,LegacyChecked<Constraints[15],A>>>;
export function toOldMap_15<A extends Registrations>(x:CheckedConstraints<Constraints[15],A>):LegacyChecked<Constraints[15],A>{return x;}
export function fromOldMap_15<A extends Registrations>(x:LegacyChecked<Constraints[15],A>):CheckedConstraints<Constraints[15],A>{return x;}
export type OpenConstraint_0<C extends NeedConstraint>=Assert<Equal<CheckedConstraints<C,Maps[0]>,LegacyChecked<C,Maps[0]>>>;
export function toOldConstraint_0<C extends NeedConstraint>(x:CheckedConstraints<C,Maps[0]>):LegacyChecked<C,Maps[0]>{return x;}
export function fromOldConstraint_0<C extends NeedConstraint>(x:LegacyChecked<C,Maps[0]>):CheckedConstraints<C,Maps[0]>{return x;}
export type OpenConstraint_1<C extends NeedConstraint>=Assert<Equal<CheckedConstraints<C,Maps[1]>,LegacyChecked<C,Maps[1]>>>;
export function toOldConstraint_1<C extends NeedConstraint>(x:CheckedConstraints<C,Maps[1]>):LegacyChecked<C,Maps[1]>{return x;}
export function fromOldConstraint_1<C extends NeedConstraint>(x:LegacyChecked<C,Maps[1]>):CheckedConstraints<C,Maps[1]>{return x;}
export type OpenConstraint_2<C extends NeedConstraint>=Assert<Equal<CheckedConstraints<C,Maps[2]>,LegacyChecked<C,Maps[2]>>>;
export function toOldConstraint_2<C extends NeedConstraint>(x:CheckedConstraints<C,Maps[2]>):LegacyChecked<C,Maps[2]>{return x;}
export function fromOldConstraint_2<C extends NeedConstraint>(x:LegacyChecked<C,Maps[2]>):CheckedConstraints<C,Maps[2]>{return x;}
export type OpenConstraint_3<C extends NeedConstraint>=Assert<Equal<CheckedConstraints<C,Maps[3]>,LegacyChecked<C,Maps[3]>>>;
export function toOldConstraint_3<C extends NeedConstraint>(x:CheckedConstraints<C,Maps[3]>):LegacyChecked<C,Maps[3]>{return x;}
export function fromOldConstraint_3<C extends NeedConstraint>(x:LegacyChecked<C,Maps[3]>):CheckedConstraints<C,Maps[3]>{return x;}
export type OpenConstraint_4<C extends NeedConstraint>=Assert<Equal<CheckedConstraints<C,Maps[4]>,LegacyChecked<C,Maps[4]>>>;
export function toOldConstraint_4<C extends NeedConstraint>(x:CheckedConstraints<C,Maps[4]>):LegacyChecked<C,Maps[4]>{return x;}
export function fromOldConstraint_4<C extends NeedConstraint>(x:LegacyChecked<C,Maps[4]>):CheckedConstraints<C,Maps[4]>{return x;}
export type OpenConstraint_5<C extends NeedConstraint>=Assert<Equal<CheckedConstraints<C,Maps[5]>,LegacyChecked<C,Maps[5]>>>;
export function toOldConstraint_5<C extends NeedConstraint>(x:CheckedConstraints<C,Maps[5]>):LegacyChecked<C,Maps[5]>{return x;}
export function fromOldConstraint_5<C extends NeedConstraint>(x:LegacyChecked<C,Maps[5]>):CheckedConstraints<C,Maps[5]>{return x;}
export type OpenConstraint_6<C extends NeedConstraint>=Assert<Equal<CheckedConstraints<C,Maps[6]>,LegacyChecked<C,Maps[6]>>>;
export function toOldConstraint_6<C extends NeedConstraint>(x:CheckedConstraints<C,Maps[6]>):LegacyChecked<C,Maps[6]>{return x;}
export function fromOldConstraint_6<C extends NeedConstraint>(x:LegacyChecked<C,Maps[6]>):CheckedConstraints<C,Maps[6]>{return x;}
export type OpenConstraint_7<C extends NeedConstraint>=Assert<Equal<CheckedConstraints<C,Maps[7]>,LegacyChecked<C,Maps[7]>>>;
export function toOldConstraint_7<C extends NeedConstraint>(x:CheckedConstraints<C,Maps[7]>):LegacyChecked<C,Maps[7]>{return x;}
export function fromOldConstraint_7<C extends NeedConstraint>(x:LegacyChecked<C,Maps[7]>):CheckedConstraints<C,Maps[7]>{return x;}
export type OpenConstraint_8<C extends NeedConstraint>=Assert<Equal<CheckedConstraints<C,Maps[8]>,LegacyChecked<C,Maps[8]>>>;
export function toOldConstraint_8<C extends NeedConstraint>(x:CheckedConstraints<C,Maps[8]>):LegacyChecked<C,Maps[8]>{return x;}
export function fromOldConstraint_8<C extends NeedConstraint>(x:LegacyChecked<C,Maps[8]>):CheckedConstraints<C,Maps[8]>{return x;}
export type OpenConstraint_9<C extends NeedConstraint>=Assert<Equal<CheckedConstraints<C,Maps[9]>,LegacyChecked<C,Maps[9]>>>;
export function toOldConstraint_9<C extends NeedConstraint>(x:CheckedConstraints<C,Maps[9]>):LegacyChecked<C,Maps[9]>{return x;}
export function fromOldConstraint_9<C extends NeedConstraint>(x:LegacyChecked<C,Maps[9]>):CheckedConstraints<C,Maps[9]>{return x;}
export type OpenConstraint_10<C extends NeedConstraint>=Assert<Equal<CheckedConstraints<C,Maps[10]>,LegacyChecked<C,Maps[10]>>>;
export function toOldConstraint_10<C extends NeedConstraint>(x:CheckedConstraints<C,Maps[10]>):LegacyChecked<C,Maps[10]>{return x;}
export function fromOldConstraint_10<C extends NeedConstraint>(x:LegacyChecked<C,Maps[10]>):CheckedConstraints<C,Maps[10]>{return x;}
export type OpenConstraint_11<C extends NeedConstraint>=Assert<Equal<CheckedConstraints<C,Maps[11]>,LegacyChecked<C,Maps[11]>>>;
export function toOldConstraint_11<C extends NeedConstraint>(x:CheckedConstraints<C,Maps[11]>):LegacyChecked<C,Maps[11]>{return x;}
export function fromOldConstraint_11<C extends NeedConstraint>(x:LegacyChecked<C,Maps[11]>):CheckedConstraints<C,Maps[11]>{return x;}
export type OpenConstraint_12<C extends NeedConstraint>=Assert<Equal<CheckedConstraints<C,Maps[12]>,LegacyChecked<C,Maps[12]>>>;
export function toOldConstraint_12<C extends NeedConstraint>(x:CheckedConstraints<C,Maps[12]>):LegacyChecked<C,Maps[12]>{return x;}
export function fromOldConstraint_12<C extends NeedConstraint>(x:LegacyChecked<C,Maps[12]>):CheckedConstraints<C,Maps[12]>{return x;}
export type OpenConstraint_13<C extends NeedConstraint>=Assert<Equal<CheckedConstraints<C,Maps[13]>,LegacyChecked<C,Maps[13]>>>;
export function toOldConstraint_13<C extends NeedConstraint>(x:CheckedConstraints<C,Maps[13]>):LegacyChecked<C,Maps[13]>{return x;}
export function fromOldConstraint_13<C extends NeedConstraint>(x:LegacyChecked<C,Maps[13]>):CheckedConstraints<C,Maps[13]>{return x;}
export type OpenConstraint_14<C extends NeedConstraint>=Assert<Equal<CheckedConstraints<C,Maps[14]>,LegacyChecked<C,Maps[14]>>>;
export function toOldConstraint_14<C extends NeedConstraint>(x:CheckedConstraints<C,Maps[14]>):LegacyChecked<C,Maps[14]>{return x;}
export function fromOldConstraint_14<C extends NeedConstraint>(x:LegacyChecked<C,Maps[14]>):CheckedConstraints<C,Maps[14]>{return x;}
export type OpenConstraint_15<C extends NeedConstraint>=Assert<Equal<CheckedConstraints<C,Maps[15]>,LegacyChecked<C,Maps[15]>>>;
export function toOldConstraint_15<C extends NeedConstraint>(x:CheckedConstraints<C,Maps[15]>):LegacyChecked<C,Maps[15]>{return x;}
export function fromOldConstraint_15<C extends NeedConstraint>(x:LegacyChecked<C,Maps[15]>):CheckedConstraints<C,Maps[15]>{return x;}
export type OpenConstraint_16<C extends NeedConstraint>=Assert<Equal<CheckedConstraints<C,Maps[16]>,LegacyChecked<C,Maps[16]>>>;
export function toOldConstraint_16<C extends NeedConstraint>(x:CheckedConstraints<C,Maps[16]>):LegacyChecked<C,Maps[16]>{return x;}
export function fromOldConstraint_16<C extends NeedConstraint>(x:LegacyChecked<C,Maps[16]>):CheckedConstraints<C,Maps[16]>{return x;}
export type OpenConstraint_17<C extends NeedConstraint>=Assert<Equal<CheckedConstraints<C,Maps[17]>,LegacyChecked<C,Maps[17]>>>;
export function toOldConstraint_17<C extends NeedConstraint>(x:CheckedConstraints<C,Maps[17]>):LegacyChecked<C,Maps[17]>{return x;}
export function fromOldConstraint_17<C extends NeedConstraint>(x:LegacyChecked<C,Maps[17]>):CheckedConstraints<C,Maps[17]>{return x;}
export type OpenConstraint_18<C extends NeedConstraint>=Assert<Equal<CheckedConstraints<C,Maps[18]>,LegacyChecked<C,Maps[18]>>>;
export function toOldConstraint_18<C extends NeedConstraint>(x:CheckedConstraints<C,Maps[18]>):LegacyChecked<C,Maps[18]>{return x;}
export function fromOldConstraint_18<C extends NeedConstraint>(x:LegacyChecked<C,Maps[18]>):CheckedConstraints<C,Maps[18]>{return x;}
export type OpenConstraint_19<C extends NeedConstraint>=Assert<Equal<CheckedConstraints<C,Maps[19]>,LegacyChecked<C,Maps[19]>>>;
export function toOldConstraint_19<C extends NeedConstraint>(x:CheckedConstraints<C,Maps[19]>):LegacyChecked<C,Maps[19]>{return x;}
export function fromOldConstraint_19<C extends NeedConstraint>(x:LegacyChecked<C,Maps[19]>):CheckedConstraints<C,Maps[19]>{return x;}
export type OpenConstraint_20<C extends NeedConstraint>=Assert<Equal<CheckedConstraints<C,Maps[20]>,LegacyChecked<C,Maps[20]>>>;
export function toOldConstraint_20<C extends NeedConstraint>(x:CheckedConstraints<C,Maps[20]>):LegacyChecked<C,Maps[20]>{return x;}
export function fromOldConstraint_20<C extends NeedConstraint>(x:LegacyChecked<C,Maps[20]>):CheckedConstraints<C,Maps[20]>{return x;}
export type OpenConstraint_21<C extends NeedConstraint>=Assert<Equal<CheckedConstraints<C,Maps[21]>,LegacyChecked<C,Maps[21]>>>;
export function toOldConstraint_21<C extends NeedConstraint>(x:CheckedConstraints<C,Maps[21]>):LegacyChecked<C,Maps[21]>{return x;}
export function fromOldConstraint_21<C extends NeedConstraint>(x:LegacyChecked<C,Maps[21]>):CheckedConstraints<C,Maps[21]>{return x;}
