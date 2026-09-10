import type {Entries,Registration} from '../src';
export function makeEntry<K extends string|symbol,V extends Registration>(key:K,registration:V):Entries<Record<K,V>>{return {key,registration};}
export function wrapEntry<K extends string|symbol,V extends Registration>(entry:{key:K;registration:V}):Entries<Record<K,V>>{return entry;}
export function makeNamed<K extends string,V extends Registration>(key:K,registration:V):Entries<Record<K,V>>{return {key,registration};}
export function makeSymbol<K extends symbol,V extends Registration>(key:K,registration:V):Entries<Record<K,V>>{return {key,registration};}
export const named=makeEntry('value',()=>1);
export const key=Symbol('value');
export const symbolic=makeEntry(key,()=>1);
