import type { Module } from './module';
import type { Registrations } from './registration';
import type { Needs, Singleton, Unsatisfied } from './types';
import type { MetadataKeyUnion, Provider, ProviderOutput, ProviderNeeds, ProviderMetadata, ProviderAcquisitionMetadata } from './provider';

export type NeedConstraint = { readonly consumer: string; readonly needs: object };

type WrongConstraint<C extends NeedConstraint, Available extends object> =
  C extends NeedConstraint
    // Public registration maps have required slots. Compare each overlapping
    // value directly to avoid rebuilding a large Pick<Available> per consumer.
    ? {
        [K in keyof C['needs'] & keyof Available]:
          Available[K] extends C['needs'][K] ? never : C['consumer'];
      }[keyof C['needs'] & keyof Available]
    : never;
type MissingConstraint<C extends NeedConstraint, Available extends object> =
  C extends NeedConstraint ? Exclude<keyof C['needs'], keyof Available> : never;

export type CheckedConstraints<C extends NeedConstraint, A extends object> =
  [WrongConstraint<C, A>] extends [never] ? unknown
    : Unsatisfied<'a dependency has the wrong shape', { tokens: WrongConstraint<C, A> }>;
export type CompleteConstraints<C extends NeedConstraint, A extends object> =
  [MissingConstraint<C, A>] extends [never] ? unknown
    : Unsatisfied<'missing factories', { missing: MissingConstraint<C, A> }>;

// Separate exported and external references even when a later rename makes
// their lookup keys equal. Keep consumers distributive, never intersect needs
// before validating them: incompatible requirements must not become `never`.
type Constraint<K extends string, N, Keys extends keyof N, Kind extends string> =
  [Keys] extends [never] ? never : { readonly consumer: K; readonly needs: Pick<N, Keys>; readonly kind: Kind };
export type ModuleConstraints<R extends Registrations, Public extends keyof R> = {
  [K in keyof R & string]:
    | Constraint<K, Needs<R[K]>, Extract<keyof Needs<R[K]>, Public>, 'export'>
    | Constraint<K, Needs<R[K]>, Exclude<keyof Needs<R[K]>, keyof R>, 'external'>;
}[keyof R & string];

type Intersect<U> = (U extends unknown ? (value: U) => void : never) extends
  (value: infer I) => void ? I : never;
type External<C> = C extends { kind: 'external'; needs: infer N } ? N : never;
export type ExternalRequirements<C> = [External<C>] extends [never] ? Readonly<{}>
  : Readonly<Intersect<External<C>>>;

export type PublicRegistrations<P extends object> = { [K in keyof P]: () => P[K] };
// Retain opaque registrations as opaque, and consider keys of every metadata
// union member before deciding whether the legacy synthetic default is enough.
export type PublicProvider<R> = R extends Registrations[string]
  ? unknown extends ProviderNeeds<R> ? R
    : [MetadataKeyUnion<ProviderMetadata<R>>] extends [never]
      ? ProviderAcquisitionMetadata<R> extends readonly [] ? () => ProviderOutput<R>
        : Provider<() => ProviderOutput<R>, ProviderMetadata<R> & object, ProviderAcquisitionMetadata<R>>
      : Provider<() => ProviderOutput<R>, ProviderMetadata<R> & object, ProviderAcquisitionMetadata<R>>
  : never;
export type PublicProviders<R extends object> = { [K in keyof R]: PublicProvider<R[K]> };
export type Renamed<P extends object, Old extends string, New extends string> = {
  [K in keyof P as K extends Old ? New : K]: P[K];
};
export type RenamedConstraints<C extends NeedConstraint, Old extends string, New extends string> =
  C extends { readonly kind: 'export' }
    ? { readonly consumer: C['consumer']; readonly needs: Renamed<C['needs'], Old, New>; readonly kind: 'export' }
    : C;
export type RenameKeys<P, Old extends string, New extends string> =
  Singleton<Old> extends true ? Singleton<New> extends true
    ? Old extends keyof P ? New extends Exclude<keyof P, Old> ? InvalidRename : unknown
      : InvalidRename : InvalidRename : InvalidRename;
type InvalidRename = Unsatisfied<'rename requires an existing export and a noncolliding singleton string-literal name', {}>;

export type ModuleProvides<M> = M extends Module<infer P, infer _R, infer _C, infer _D> ? Readonly<P> : never;
export type ModuleRequires<M> = M extends Module<infer _P, infer R, infer _C, infer _D> ? Readonly<R> : never;
