import { DiBag, type Builder, type ProviderGraphContract, type TokenDependencyContract } from '../../src';
import type { Assert, Equal } from './assert';
import type { Entry, RegistrationsFromEntries, ServicesOf } from '../../src/types';

const before = DiBag.createBuilder().register({
  value: () => 1,
  read: ({ value }: { value: number }) => value.toFixed(),
});

export const changed = before.replace('read', () => true).replace('value', () => 'new');
const finalized = changed.build();
export const synchronous = finalized.resolve('value');
export const changedRead = finalized.resolve('read');

type BuilderEntries<B> = B extends Builder<infer E extends Entry, infer _C> ? E : never;
type ChangedRegistrations = RegistrationsFromEntries<BuilderEntries<typeof changed>>;
export type ProjectionCompatibility = [
  Assert<Equal<typeof synchronous, string>>,
  Assert<Equal<typeof changedRead, boolean>>,
  Assert<Equal<ServicesOf<ChangedRegistrations>, { value: string; read: boolean }>>,
  Assert<Equal<ProviderGraphContract<ChangedRegistrations['value']>, TokenDependencyContract>>,
  Assert<Equal<ProviderGraphContract<ChangedRegistrations['read']>, TokenDependencyContract>>,
];

const namedForward = DiBag.createBuilder().register({ unrelated: () => ({ retained: true as const }), value: () => 1 }).register({ read: ({ value }: { value: number }) => value.toFixed() }).build();
const namedReverse = DiBag.createBuilder().register({ read: ({ value }: { value: number }) => value.toFixed() }).register({ unrelated: () => ({ retained: true as const }), value: () => 1 }).build();

const key = Symbol('projection-boundary');
const token = DiBag.token(key).of<number>();
const equivalent = DiBag.token(key).of<number>();
const tokenForward = DiBag.createBuilder().register({ unrelated: () => true }).register(token, () => 1).register({ read: DiBag.fromFunction([equivalent], value => value.toFixed()) }).build();
const tokenReverse = DiBag.createBuilder().register({ read: DiBag.fromFunction([equivalent], value => value.toFixed()) }).register({ unrelated: () => true }).register(token, () => 1).build();

export type IndependentBoundaries = [
  Assert<Equal<ReturnType<typeof namedForward.resolve<'read'>>, string>>,
  Assert<Equal<ReturnType<typeof namedReverse.resolve<'read'>>, string>>,
  Assert<Equal<ReturnType<typeof tokenForward.resolve<typeof token>>, number>>,
  Assert<Equal<ReturnType<typeof tokenForward.resolve<'read'>>, string>>,
  Assert<Equal<ReturnType<typeof tokenReverse.resolve<typeof token>>, number>>,
  Assert<Equal<ReturnType<typeof tokenReverse.resolve<'read'>>, string>>,
];
