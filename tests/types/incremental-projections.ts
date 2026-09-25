import { DiBag, type Builder, type ProviderGraphContract, type TokenDependencyContract } from '../../src';
import type { Assert, Equal } from './assert';
import type { Entry, RegistrationsFromEntries, ServicesOf } from '../../src/types';

const before = DiBag.createBuilder().withServices({
  value: () => 1,
  read: ({ value }: { value: number }) => value.toFixed(),
});

export const changed = before.withReplacedService('read', () => true).withReplacedService('value', () => 'new');
const finalized = changed.buildContainer();
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

const namedForward = DiBag.createBuilder().withServices({ unrelated: () => ({ retained: true as const }), value: () => 1 }).withServices({ read: ({ value }: { value: number }) => value.toFixed() }).buildContainer();
const namedReverse = DiBag.createBuilder().withServices({ read: ({ value }: { value: number }) => value.toFixed() }).withServices({ unrelated: () => ({ retained: true as const }), value: () => 1 }).buildContainer();

const key = Symbol('projection-boundary');
const token = DiBag.createToken(key).forService<number>();
const equivalent = DiBag.createToken(key).forService<number>();
const tokenForward = DiBag.createBuilder().withServices({ unrelated: () => true }).withTokenService(token, () => 1).withServices({ read: DiBag.createProviderFromFunction({ dependencies: [equivalent], factoryFunction: value => value.toFixed() }) }).buildContainer();
const tokenReverse = DiBag.createBuilder().withServices({ read: DiBag.createProviderFromFunction({ dependencies: [equivalent], factoryFunction: value => value.toFixed() }) }).withServices({ unrelated: () => true }).withTokenService(token, () => 1).buildContainer();

export type IndependentBoundaries = [
  Assert<Equal<ReturnType<typeof namedForward.resolve<'read'>>, string>>,
  Assert<Equal<ReturnType<typeof namedReverse.resolve<'read'>>, string>>,
  Assert<Equal<ReturnType<typeof tokenForward.resolve<typeof token>>, number>>,
  Assert<Equal<ReturnType<typeof tokenForward.resolve<'read'>>, string>>,
  Assert<Equal<ReturnType<typeof tokenReverse.resolve<typeof token>>, number>>,
  Assert<Equal<ReturnType<typeof tokenReverse.resolve<'read'>>, string>>,
];
