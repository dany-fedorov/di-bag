import { DiBag, type ModuleContributions } from '../../src';
import type { Assert, Equal } from './assert';
export const key = Symbol('numbers');
export const numbers = DiBag.token(key).of<number>();
export const builder = DiBag.begin().contribute(numbers, () => 1).contribute(numbers, () => 2);
export const feature = DiBag.module().contribute(numbers, () => 3).exports([]);
export const bag = builder.install(feature).end();
export const values = bag.resolveAll(numbers);
export const contribute = builder.contribute;
export type ReflectedContribution = ReturnType<typeof contribute>;
export type Exact = [Assert<Equal<typeof values, ReadonlyArray<number>>>,
  Assert<Equal<ModuleContributions<typeof feature>, Readonly<{ [key]: ReadonlyArray<number> }>>>];
const empty = DiBag.begin().end().resolveAll(numbers);
export type Empty = Assert<Equal<typeof empty, ReadonlyArray<number>>>;
export const all = DiBag.all(numbers);
export const allProvider = DiBag.fromTokens([all], values => values);
export const aggregate = DiBag.begin().add({ values: allProvider });
export const aggregateBag = aggregate.contribute(numbers, () => 1).end();
export const moduleBuilder = DiBag.module().contribute(numbers, ({ helper }: { helper: number }) => helper);
export const moduleContribute = moduleBuilder.contribute;
export const privateFeature = moduleBuilder.add({ helper: () => 1 }).exports([]);
export const privateHost = DiBag.begin().install(privateFeature).end();
export const needsFeature = moduleBuilder.exports([]);
export const needsHost = DiBag.begin().install(needsFeature);
export const renamedFeature = moduleBuilder.add({ helper: () => 1 }).exports(['helper']).rename('helper', 'renamed');
export const renamedHost = DiBag.begin().install(renamedFeature).end();
const rooted = DiBag.withLifetime(() => 1, 'root');
const rootAll = DiBag.withLifetime(allProvider, 'root');
export const emptyRoot = DiBag.begin().add({ rootAll }).end();
export const rootBag = DiBag.begin().contribute(numbers, rooted).add({ rootAll }).end();
export const privateRootFeature = DiBag.module().add({ helper: rooted }).contribute(numbers, DiBag.withLifetime(({ helper }: { helper: number }) => helper, 'transient')).exports([]);
export const privateRootHost = DiBag.begin().install(privateRootFeature).add({ rootAll }).end();
export const rootContribution = DiBag.module().add({ helper: rooted }).contribute(numbers, DiBag.withLifetime(({ helper }: { helper: number }) => helper, 'root')).exports([]);
DiBag.begin().install(rootContribution).end();
class Collection { constructor(readonly values: readonly number[]) {} }
const classProvider = DiBag.fromClass([all], Collection);
const functionProvider = DiBag.fromFunction([all], values => values);
export const adapters = DiBag.begin().add({ classProvider, functionProvider }).end();
export type MoreExact = [Assert<Equal<ReturnType<typeof bag.resolveAll<typeof numbers>>, readonly number[]>>,
  Assert<Equal<ModuleContributions<ReturnType<ReturnType<typeof DiBag.module>['exports']>>, Readonly<{}>>>,
  Assert<Equal<ReturnType<typeof aggregateBag.resolve<'values'>>, readonly number[]>>];
export function inferredContribution() { return builder.contribute(numbers, () => 4); }
export function explicitContribution() { return builder.contribute<typeof numbers, () => number>(numbers, () => 4); }
type IsAny<T> = 0 extends (1 & T) ? true : false;
export type ReflectedExact = [Assert<Equal<IsAny<ReturnType<typeof contribute>>, false>>,
  Assert<Equal<IsAny<Parameters<typeof contribute>[1]>, false>>,
  Assert<Equal<ReturnType<typeof inferredContribution>, ReturnType<typeof explicitContribution>>>];
export const promisedKey = Symbol('promise'); export const promised = DiBag.token(promisedKey).of<Promise<number>>();
export const promiseBag = DiBag.begin().contribute(promised, DiBag.factory(() => Promise.resolve(1), { acquisition: 'raw' })).end();
const promisedValues = promiseBag.resolveAll(promised);
export type PromiseExact = Assert<Equal<typeof promisedValues, readonly Promise<number>[]>>;
const rootAliasFeature = DiBag.module().add({ helper: rooted }).alias('copy', 'helper')
  .contribute(numbers, DiBag.withLifetime(({ copy }: { copy: number }) => copy, 'transient')).exports([]);
DiBag.begin().install(rootAliasFeature).add({ rootAll }).end();
export const scopedAggregate = rootBag.scope();
export const rootedHelper = DiBag.begin().add({ helper: rooted, rootAll: allProvider })
  .contribute(numbers, DiBag.withLifetime(({ helper }: { helper: number }) => helper, 'transient')).end();
rootedHelper.scope(['rootAll'], { rootAll: DiBag.withLifetime(allProvider, 'root') });
export const replacementContext = DiBag.begin().add({ clock: () => ({ now: () => 1, unused: () => true }) })
  .contribute(numbers, ({ clock }: { clock: { now(): number } }) => clock.now())
  .replace('clock', () => ({ now() { return 2; }, extra() { return true; } })).end();
export const moduleReplacementContext = DiBag.module().add({ clock: () => ({ now: () => 1, unused: () => true }) })
  .contribute(numbers, ({ clock }: { clock: { now(): number } }) => clock.now())
  .replace('clock', () => ({ now() { return 2; }, extra() { return true; } })).exports([]);
export type ReplacementExact = Assert<Equal<ReturnType<typeof replacementContext.resolve<'clock'>>, { now(): number; extra(): boolean }>>;
export const sharedAliasBase = DiBag.begin().add({ helper: rooted, consumer: allProvider }).alias('copy', 'helper')
  .contribute(numbers, DiBag.withLifetime(({ copy }: { copy: number }) => copy, 'transient')).end();
export const sharedAliasRoot = sharedAliasBase.scope(['helper', 'consumer'], { helper: () => 2, consumer: rootAll }, { share: ['copy'] });
