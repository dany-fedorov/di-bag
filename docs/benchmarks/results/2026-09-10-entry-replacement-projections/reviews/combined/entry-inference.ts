import type { Entries,From,Registration } from '../src';
import { DiBag } from '../src';
declare function inferFactory<V extends Registration>(entry:Entries<{service:V}>):V;
declare function inferValue<T>(entry:Entries<{service:()=>T}>):T;
declare function inferKey<K extends string|symbol>(entry:Entries<Record<K,()=>1>>):K;
export const inferredFactory=inferFactory({key:'service',registration:()=>42 as const});
export const inferredObject=inferValue({key:'service',registration:()=>({kind:'entry' as const})});
export const inferredPromise=inferValue({key:'service',registration:()=>Promise.resolve(42 as const)});
export const inferredCallback=inferValue({key:'service',registration:()=>(n:number)=>String(n)});
export const inferredNamed=inferKey({key:'named' as const,registration:()=>1 as const});
export const tokenKey=Symbol('entry');
export const inferredSymbol=inferKey({key:tokenKey,registration:()=>1 as const});
declare const union:Entries<{one:()=>1;two:()=>1}>;
export const inferredUnionKey=inferKey(union);
export function optionalProjectionStillChecked(){
 type Optional={value:()=>1;use?:()=>number};
 // @ts-expect-error Optional registrations still cannot satisfy Entry for From.
 type Rejected=From<Entries<Optional>>;
}
export const batch=DiBag.begin().add({value:()=>({read:()=>1}),use:({value}:{value:{read():number}})=>value.read()});
export const replaced=batch.replace('value',()=>({read(){return 2;},extra(){return 'retained' as const;}}));
export const selected=replaced.end().resolve('value');
