import { DiBag, type Builder, type ProviderGraph, type TokenGraph } from '../../src';
import type { Assert, Equal } from './assert';
import type { Entry, From, Provided } from '../../src/types';

const before = DiBag.begin().add({
  value: () => 1,
  read: ({ value }: { value: number }) => value.toFixed(),
});

export const changed = before
  .replace('read', () => true)
  .replace('value', () => 'new');
const finalized = changed.end();
export const synchronous = finalized.resolve('value');
export const changedRead = finalized.resolve('read');

type BuilderEntries<B> = B extends Builder<infer E extends Entry, infer _C> ? E : never;
type ChangedRegistrations = From<BuilderEntries<typeof changed>>;
export type ProjectionCompatibility = [
  Assert<Equal<typeof synchronous, string>>,
  Assert<Equal<typeof changedRead, boolean>>,
  Assert<Equal<Provided<ChangedRegistrations>, { value: string; read: boolean }>>,
  Assert<Equal<ProviderGraph<ChangedRegistrations['value']>, TokenGraph>>,
  Assert<Equal<ProviderGraph<ChangedRegistrations['read']>, TokenGraph>>,
];

const namedForward = DiBag.begin()
  .add({ unrelated: () => ({ retained: true as const }), value: () => 1 })
  .add({ read: ({ value }: { value: number }) => value.toFixed() })
  .end();
const namedReverse = DiBag.begin()
  .add({ read: ({ value }: { value: number }) => value.toFixed() })
  .add({ unrelated: () => ({ retained: true as const }), value: () => 1 })
  .end();

const key = Symbol('projection-boundary');
const token = DiBag.token(key).of<number>();
const equivalent = DiBag.token(key).of<number>();
const tokenForward = DiBag.begin()
  .add({ unrelated: () => true })
  .bind(token, () => 1)
  .add({ read: DiBag.fromTokens([equivalent], value => value.toFixed()) })
  .end();
const tokenReverse = DiBag.begin()
  .add({ read: DiBag.fromTokens([equivalent], value => value.toFixed()) })
  .add({ unrelated: () => true })
  .bind(token, () => 1)
  .end();

export type IndependentBoundaries = [
  Assert<Equal<ReturnType<typeof namedForward.resolve<'read'>>, string>>,
  Assert<Equal<ReturnType<typeof namedReverse.resolve<'read'>>, string>>,
  Assert<Equal<ReturnType<typeof tokenForward.resolve<typeof token>>, number>>,
  Assert<Equal<ReturnType<typeof tokenForward.resolve<'read'>>, string>>,
  Assert<Equal<ReturnType<typeof tokenReverse.resolve<typeof token>>, number>>,
  Assert<Equal<ReturnType<typeof tokenReverse.resolve<'read'>>, string>>,
];
