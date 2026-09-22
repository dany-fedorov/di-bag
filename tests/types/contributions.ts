import { DiBag, type ModuleContributions } from '../../src';
import type { Assert, Equal } from './assert';
export const key = Symbol('numbers');
export const numbers = DiBag.token(key).forCollectionOf<number>();
export const builder = DiBag.createBuilder().withCollectionContribution({ collectionToken: numbers, provider: () => 1 }).withCollectionContribution({ collectionToken: numbers, provider: () => 2 });
export const feature = DiBag.createBuilder().withCollectionContribution({ collectionToken: numbers, provider: () => 3 }).buildModule({ exportedServiceKeys: [] });
export const bag = builder.withInstalledModules([feature]).buildContainer();
export const values = bag.resolveCollection(numbers);
export const resolveCollectionMethod = bag.resolveCollection;
export const inspectCollectionMethod = bag.inspectCollection;
export const contribute = builder.contribute;
export type ReflectedContribution = ReturnType<typeof contribute>;
export type Exact = [Assert<Equal<typeof values, ReadonlyArray<number>>>,
  Assert<Equal<ModuleContributions<typeof feature>, Readonly<{ [key]: ReadonlyArray<number> }>>>];
const empty = DiBag.createBuilder().buildContainer().resolveCollection(numbers);
export type Empty = Assert<Equal<typeof empty, ReadonlyArray<number>>>;
export const all = numbers;
export const allProvider = DiBag.fromFunction([all], values => values);
export const aggregate = DiBag.createBuilder().withServices({ values: allProvider });
export const aggregateBag = aggregate.withCollectionContribution({ collectionToken: numbers, provider: () => 1 }).buildContainer();
export const moduleBuilder = DiBag.createBuilder().withCollectionContribution({ collectionToken: numbers, provider: ({ helper }: { helper: number }) => helper });
export const moduleContribute = moduleBuilder.contribute;
export const privateFeature = moduleBuilder.withServices({ helper: () => 1 }).buildModule({ exportedServiceKeys: [] });
export const privateHost = DiBag.createBuilder().withInstalledModules([privateFeature]).buildContainer();
export const needsFeature = moduleBuilder.buildModule({ exportedServiceKeys: [] });
export const needsHost = DiBag.createBuilder().withInstalledModules([needsFeature]);
export const renamedFeature = moduleBuilder.withServices({ helper: () => 1 }).buildModule({ exportedServiceKeys: ['helper'] }).renameExport('helper', 'renamed');
export const renamedHost = DiBag.createBuilder().withInstalledModules([renamedFeature]).buildContainer();
const rooted = DiBag.withLifetime(() => 1, 'root');
const rootAll = DiBag.withLifetime(allProvider, 'root');
export const emptyRoot = DiBag.createBuilder().withServices({ rootAll }).buildContainer();
export const rootBag = DiBag.createBuilder().withCollectionContribution({ collectionToken: numbers, provider: rooted }).withServices({ rootAll }).buildContainer();
export const privateRootFeature = DiBag.createBuilder().withServices({ helper: rooted }).withCollectionContribution({ collectionToken: numbers, provider: DiBag.withLifetime(({ helper }: { helper: number }) => helper, 'transient') }).buildModule({ exportedServiceKeys: [] });
export const privateRootHost = DiBag.createBuilder().withInstalledModules([privateRootFeature]).withServices({ rootAll }).buildContainer();
export const rootContribution = DiBag.createBuilder().withServices({ helper: rooted }).withCollectionContribution({ collectionToken: numbers, provider: DiBag.withLifetime(({ helper }: { helper: number }) => helper, 'root') }).buildModule({ exportedServiceKeys: [] });
DiBag.createBuilder().withInstalledModules([rootContribution]).buildContainer();
class Collection { constructor(readonly values: readonly number[]) {} }
const classProvider = DiBag.fromClass([all], Collection);
const functionProvider = DiBag.fromFunction([all], values => values);
export const adapters = DiBag.createBuilder().withServices({ classProvider, functionProvider }).buildContainer();
export type MoreExact = [Assert<Equal<ReturnType<typeof bag.resolveCollection<typeof numbers>>, readonly number[]>>,
  Assert<Equal<ModuleContributions<ReturnType<ReturnType<typeof DiBag.createBuilder>['buildModule']>>, Readonly<{}>>>,
  Assert<Equal<ReturnType<typeof aggregateBag.resolve<'values'>>, readonly number[]>>];
export function inferredContribution() { return builder.withCollectionContribution({ collectionToken: numbers, provider: () => 4 }); }
export function explicitContribution() { return builder.withCollectionContribution<typeof numbers, () => number>({ collectionToken: numbers, provider: () => 4 }); }
type IsAny<T> = 0 extends (1 & T) ? true : false;
export type ReflectedExact = [Assert<Equal<IsAny<ReturnType<typeof contribute>>, false>>,
  Assert<Equal<IsAny<Parameters<typeof contribute>[1]>, false>>,
  Assert<Equal<ReturnType<typeof inferredContribution>, ReturnType<typeof explicitContribution>>>];
export const promisedKey = Symbol('promise'); export const promised = DiBag.token(promisedKey).forCollectionOf<Promise<number>>();
export const promiseBag = DiBag.createBuilder().withCollectionContribution({ collectionToken: promised, provider: DiBag.fromFactory(() => Promise.resolve(1), { acquisitionMode: 'raw' }) }).buildContainer();
const promisedValues = promiseBag.resolveCollection(promised);
export type PromiseExact = Assert<Equal<typeof promisedValues, readonly Promise<number>[]>>;
const rootAliasFeature = DiBag.createBuilder().withServices({ helper: rooted }).withServiceAlias({ aliasKey: 'copy', targetServiceKey: 'helper' }).withCollectionContribution({ collectionToken: numbers, provider: DiBag.withLifetime(({ copy }: { copy: number }) => copy, 'transient') }).buildModule({ exportedServiceKeys: [] });
DiBag.createBuilder().withInstalledModules([rootAliasFeature]).withServices({ rootAll }).buildContainer();
export const scopedAggregate = rootBag.createScope();
export const rootedHelper = DiBag.createBuilder().withServices({ helper: rooted, rootAll: allProvider }).withCollectionContribution({ collectionToken: numbers, provider: DiBag.withLifetime(({ helper }: { helper: number }) => helper, 'transient') }).buildContainer();
rootedHelper.createScope(['rootAll'], { rootAll: DiBag.withLifetime(allProvider, 'root') });
export const replacementContext = DiBag.createBuilder().withServices({ clock: () => ({ now: () => 1, unused: () => true }) }).withCollectionContribution({ collectionToken: numbers, provider: ({ clock }: { clock: { now(): number } }) => clock.now() }).withReplacedService('clock', () => ({ now() { return 2; }, extra() { return true; } })).buildContainer();
export const moduleReplacementContext = DiBag.createBuilder().withServices({ clock: () => ({ now: () => 1, unused: () => true }) }).withCollectionContribution({ collectionToken: numbers, provider: ({ clock }: { clock: { now(): number } }) => clock.now() }).withReplacedService('clock', () => ({ now() { return 2; }, extra() { return true; } })).buildModule({ exportedServiceKeys: [] });
export type ReplacementExact = Assert<Equal<ReturnType<typeof replacementContext.resolve<'clock'>>, { now(): number; extra(): boolean }>>;
export const sharedAliasBase = DiBag.createBuilder().withServices({ helper: rooted, consumer: allProvider }).withServiceAlias({ aliasKey: 'copy', targetServiceKey: 'helper' }).withCollectionContribution({ collectionToken: numbers, provider: DiBag.withLifetime(({ copy }: { copy: number }) => copy, 'transient') }).buildContainer();
export const sharedAliasRoot = sharedAliasBase.createScope(['helper', 'consumer'], { helper: () => 2, consumer: rootAll }, { share: ['copy'] });
