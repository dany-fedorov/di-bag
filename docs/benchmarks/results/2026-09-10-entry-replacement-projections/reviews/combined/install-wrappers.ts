import {DiBag} from '../src';
import type {Builder,Module,Entries,From} from '../src';
import type {Entry,EntryKeys,IntroducesKeys,IncrementalChecked} from '../src/types';
import type {Registrations} from '../src/registration';
import type {NeedConstraint,IncrementalConstraints} from '../src/module-types';

export function install<E extends Entry,C extends NeedConstraint,P extends object,R extends object,MC extends NeedConstraint,D extends Registrations>(
 builder:Builder<E,C>,
 module:Module<P,R,MC,D> & IntroducesKeys<EntryKeys<E>,keyof D> & IncrementalChecked<E,D> & IncrementalConstraints<C,MC,From<E>,D>,
):Builder<E|Entries<D>,C|MC>{return builder.install<P,R,MC,D>(module);}

export function installEmpty<P extends object,R extends object,MC extends NeedConstraint,D extends Registrations>(
 builder:Builder<never>,
 module:Module<P,R,MC,D> & IntroducesKeys<EntryKeys<never>,keyof D> & IncrementalChecked<never,D> & IncrementalConstraints<never,MC,From<never>,D>,
):Builder<Entries<D>,MC>{return builder.install<P,R,MC,D>(module);}

export function installInferred<E extends Entry,C extends NeedConstraint,P extends object,R extends object,MC extends NeedConstraint,D extends Registrations>(
 builder:Builder<E,C>,
 module:Module<P,R,MC,D> & IntroducesKeys<EntryKeys<E>,keyof D> & IncrementalChecked<E,D> & IncrementalConstraints<C,MC,From<E>,D>,
){return builder.install<P,R,MC,D>(module);}

export const module=DiBag.module().add({value:()=>1}).exports(['value']);
export const original=DiBag.begin().install(module);
export const wrapped=install(DiBag.begin(),module);
export const explicit:Builder<Entries<{value:()=>number}>>=original;
export const inferred=installInferred(DiBag.begin(),module);
export const value:number=wrapped.end().resolve('value');
export const inferredValue:number=inferred.end().resolve('value');
