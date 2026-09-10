import { DiBag, type ModuleContributions } from '../../src';
import type { Assert, Equal } from './assert';
export const key = Symbol('numbers');
export const numbers = DiBag.token(key).of<number>();
export const builder = DiBag.createBuilder().contribute(numbers, () => 1).contribute(numbers, () => 2);
export const feature = DiBag.createBuilder().contribute(numbers, () => 3).buildModule([]);
export const bag = builder.installModule(feature).build();
export const values = bag.resolveAll(numbers);
export const contribute = builder.contribute;
export type ReflectedContribution = ReturnType<typeof contribute>;
export type Exact = [Assert<Equal<typeof values, ReadonlyArray<number>>>,
  Assert<Equal<ModuleContributions<typeof feature>, Readonly<{ [key]: ReadonlyArray<number> }>>>];
const empty = DiBag.createBuilder().build().resolveAll(numbers);
export type Empty = Assert<Equal<typeof empty, ReadonlyArray<number>>>;
export const all = DiBag.all(numbers);
export const allProvider = DiBag.fromFunction([all], values => values);
export const aggregate = DiBag.createBuilder().register({ values: allProvider });
export const aggregateBag = aggregate.contribute(numbers, () => 1).build();
export const moduleBuilder = DiBag.createBuilder().contribute(numbers, ({ helper }: { helper: number }) => helper);
export const moduleContribute = moduleBuilder.contribute;
export const privateFeature = moduleBuilder.register({ helper: () => 1 }).buildModule([]);
export const privateHost = DiBag.createBuilder().installModule(privateFeature).build();
export const needsFeature = moduleBuilder.buildModule([]);
export const needsHost = DiBag.createBuilder().installModule(needsFeature);
export const renamedFeature = moduleBuilder.register({ helper: () => 1 }).buildModule(['helper']).renameExport('helper', 'renamed');
export const renamedHost = DiBag.createBuilder().installModule(renamedFeature).build();
const rooted = DiBag.withLifetime(() => 1, 'root');
const rootAll = DiBag.withLifetime(allProvider, 'root');
export const emptyRoot = DiBag.createBuilder().register({ rootAll }).build();
export const rootBag = DiBag.createBuilder().contribute(numbers, rooted).register({ rootAll }).build();
export const privateRootFeature = DiBag.createBuilder().register({ helper: rooted }).contribute(numbers, DiBag.withLifetime(({ helper }: { helper: number }) => helper, 'transient')).buildModule([]);
export const privateRootHost = DiBag.createBuilder().installModule(privateRootFeature).register({ rootAll }).build();
export const rootContribution = DiBag.createBuilder().register({ helper: rooted }).contribute(numbers, DiBag.withLifetime(({ helper }: { helper: number }) => helper, 'root')).buildModule([]);
DiBag.createBuilder().installModule(rootContribution).build();
class Collection { constructor(readonly values: readonly number[]) {} }
const classProvider = DiBag.fromClass([all], Collection);
const functionProvider = DiBag.fromFunction([all], values => values);
export const adapters = DiBag.createBuilder().register({ classProvider, functionProvider }).build();
export type MoreExact = [Assert<Equal<ReturnType<typeof bag.resolveAll<typeof numbers>>, readonly number[]>>,
  Assert<Equal<ModuleContributions<ReturnType<ReturnType<typeof DiBag.createBuilder>['buildModule']>>, Readonly<{}>>>,
  Assert<Equal<ReturnType<typeof aggregateBag.resolve<'values'>>, readonly number[]>>];
export function inferredContribution() { return builder.contribute(numbers, () => 4); }
export function explicitContribution() { return builder.contribute<typeof numbers, () => number>(numbers, () => 4); }
type IsAny<T> = 0 extends (1 & T) ? true : false;
export type ReflectedExact = [Assert<Equal<IsAny<ReturnType<typeof contribute>>, false>>,
  Assert<Equal<IsAny<Parameters<typeof contribute>[1]>, false>>,
  Assert<Equal<ReturnType<typeof inferredContribution>, ReturnType<typeof explicitContribution>>>];
export const promisedKey = Symbol('promise'); export const promised = DiBag.token(promisedKey).of<Promise<number>>();
export const promiseBag = DiBag.createBuilder().contribute(promised, DiBag.fromFactory(() => Promise.resolve(1), { acquisitionMode: 'raw' })).build();
const promisedValues = promiseBag.resolveAll(promised);
export type PromiseExact = Assert<Equal<typeof promisedValues, readonly Promise<number>[]>>;
const rootAliasFeature = DiBag.createBuilder().register({ helper: rooted }).alias('copy', 'helper').contribute(numbers, DiBag.withLifetime(({ copy }: { copy: number }) => copy, 'transient')).buildModule([]);
DiBag.createBuilder().installModule(rootAliasFeature).register({ rootAll }).build();
export const scopedAggregate = rootBag.createScope();
export const rootedHelper = DiBag.createBuilder().register({ helper: rooted, rootAll: allProvider }).contribute(numbers, DiBag.withLifetime(({ helper }: { helper: number }) => helper, 'transient')).build();
rootedHelper.createScope(['rootAll'], { rootAll: DiBag.withLifetime(allProvider, 'root') });
export const replacementContext = DiBag.createBuilder().register({ clock: () => ({ now: () => 1, unused: () => true }) }).contribute(numbers, ({ clock }: { clock: { now(): number } }) => clock.now()).replace('clock', () => ({ now() { return 2; }, extra() { return true; } })).build();
export const moduleReplacementContext = DiBag.createBuilder().register({ clock: () => ({ now: () => 1, unused: () => true }) }).contribute(numbers, ({ clock }: { clock: { now(): number } }) => clock.now()).replace('clock', () => ({ now() { return 2; }, extra() { return true; } })).buildModule([]);
export type ReplacementExact = Assert<Equal<ReturnType<typeof replacementContext.resolve<'clock'>>, { now(): number; extra(): boolean }>>;
export const sharedAliasBase = DiBag.createBuilder().register({ helper: rooted, consumer: allProvider }).alias('copy', 'helper').contribute(numbers, DiBag.withLifetime(({ copy }: { copy: number }) => copy, 'transient')).build();
export const sharedAliasRoot = sharedAliasBase.createScope(['helper', 'consumer'], { helper: () => 2, consumer: rootAll }, { share: ['copy'] });
