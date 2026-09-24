import { DiBag, type ModuleContributions } from '../../src';
import type { Assert, Equal } from './assert';
export const key = Symbol('numbers');
export const numbers = DiBag.createToken(key).forCollectionOf<number>();
export const builder = DiBag.createBuilder().withCollectionContribution({ collectionToken: numbers, provider: DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'scoped:one-per-container' }) }).withCollectionContribution({ collectionToken: numbers, provider: DiBag.providerWithLifetime({ provider: () => 2, lifetime: 'scoped:one-per-container' }) });
export const feature = DiBag.createBuilder().withCollectionContribution({ collectionToken: numbers, provider: DiBag.providerWithLifetime({ provider: () => 3, lifetime: 'scoped:one-per-container' }) }).buildModule({ exportedServiceKeys: [] });
export const bag = builder.withInstalledModules([feature]).buildContainer();
export const values = bag.resolveCollection(numbers);
export const resolveCollectionMethod = bag.resolveCollection;
export const collectionSnapshotMethod = bag.serviceSnapshot;
export const contribute = builder.withCollectionContribution;
export type ReflectedContribution = ReturnType<typeof contribute>;
export type Exact = [Assert<Equal<typeof values, ReadonlyArray<number>>>,
  Assert<Equal<ModuleContributions<typeof feature>, Readonly<{ [key]: ReadonlyArray<number> }>>>];
const empty = DiBag.createBuilder().buildContainer().resolveCollection(numbers);
export type Empty = Assert<Equal<typeof empty, ReadonlyArray<number>>>;
export const all = numbers;
export const allProvider = DiBag.createProviderFromFunction({ dependencies: [all], factoryFunction: values => values });
export const aggregate = DiBag.createBuilder().withServices({ values: DiBag.providerWithLifetime({ provider: allProvider, lifetime: 'scoped:one-per-container' }) });
export const aggregateBag = aggregate.withCollectionContribution({ collectionToken: numbers, provider: DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'scoped:one-per-container' }) }).buildContainer();
export const serviceSnapshotMethod = aggregateBag.serviceSnapshot;
export const moduleBuilder = DiBag.createBuilder().withCollectionContribution({ collectionToken: numbers, provider: DiBag.providerWithLifetime({ provider: ({ helper }: { helper: number }) => helper, lifetime: 'scoped:one-per-container' }) });
export const renamedFeatureCurrent = moduleBuilder.withServices({ helper: DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'scoped:one-per-container' }) })
  .buildModule({ exportedServiceKeys: ['helper'] })
  .withRenamedExport({ currentExportKey: 'helper', newExportKey: 'renamedCurrent' });
export const moduleContribute = moduleBuilder.withCollectionContribution;
export const privateFeature = moduleBuilder.withServices({ helper: DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'scoped:one-per-container' }) }).buildModule({ exportedServiceKeys: [] });
export const privateHost = DiBag.createBuilder().withInstalledModules([privateFeature]).buildContainer();
export const needsFeature = moduleBuilder.buildModule({ exportedServiceKeys: [] });
export const needsHost = DiBag.createBuilder().withInstalledModules([needsFeature]);
export const renamedFeature = moduleBuilder.withServices({ helper: DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'scoped:one-per-container' }) }).buildModule({ exportedServiceKeys: ['helper'] }).withRenamedExport({ currentExportKey: 'helper', newExportKey: 'renamed' });
export const renamedHost = DiBag.createBuilder().withInstalledModules([renamedFeature]).buildContainer();
const rooted = DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'singleton:one-per-container-tree' });
const rootAll = DiBag.providerWithLifetime({ provider: allProvider, lifetime: 'singleton:one-per-container-tree' });
export const emptyRoot = DiBag.createBuilder().withServices({ rootAll }).buildContainer();
export const rootBag = DiBag.createBuilder().withCollectionContribution({ collectionToken: numbers, provider: rooted }).withServices({ rootAll }).buildContainer();
export const privateRootFeature = DiBag.createBuilder().withServices({ helper: rooted }).withCollectionContribution({ collectionToken: numbers, provider: DiBag.providerWithLifetime({ provider: ({ helper }: { helper: number }) => helper, lifetime: 'transient:one-per-resolve' }) }).buildModule({ exportedServiceKeys: [] });
export const privateRootHost = DiBag.createBuilder().withInstalledModules([privateRootFeature]).withServices({ rootAll }).buildContainer();
export const rootContribution = DiBag.createBuilder().withServices({ helper: rooted }).withCollectionContribution({ collectionToken: numbers, provider: DiBag.providerWithLifetime({ provider: ({ helper }: { helper: number }) => helper, lifetime: 'singleton:one-per-container-tree' }) }).buildModule({ exportedServiceKeys: [] });
DiBag.createBuilder().withInstalledModules([rootContribution]).buildContainer();
class Collection { constructor(readonly values: readonly number[]) {} }
const classProvider = DiBag.createProviderFromClass({ dependencies: [all], serviceClass: Collection });
const functionProvider = DiBag.createProviderFromFunction({ dependencies: [all], factoryFunction: values => values });
export const adapters = DiBag.createBuilder().withServices({ classProvider: DiBag.providerWithLifetime({ provider: classProvider, lifetime: 'scoped:one-per-container' }), functionProvider: DiBag.providerWithLifetime({ provider: functionProvider, lifetime: 'scoped:one-per-container' }) }).buildContainer();
export type MoreExact = [Assert<Equal<ReturnType<typeof bag.resolveCollection<typeof numbers>>, readonly number[]>>,
  Assert<Equal<ModuleContributions<ReturnType<ReturnType<typeof DiBag.createBuilder>['buildModule']>>, Readonly<{}>>>,
  Assert<Equal<ReturnType<typeof aggregateBag.resolve<'values'>>, readonly number[]>>];
export function inferredContribution() { return builder.withCollectionContribution({ collectionToken: numbers, provider: DiBag.providerWithLifetime({ provider: () => 4, lifetime: 'scoped:one-per-container' }) }); }
export function explicitContribution() {
  const scoped = DiBag.providerWithLifetime({ provider: () => 4, lifetime: 'scoped:one-per-container' });
  return builder.withCollectionContribution<typeof numbers, typeof scoped>({ collectionToken: numbers, provider: scoped });
}
type IsAny<T> = 0 extends (1 & T) ? true : false;
export type ReflectedExact = [Assert<Equal<IsAny<ReturnType<typeof contribute>>, false>>,
  Assert<Equal<IsAny<Parameters<typeof contribute>[0]['provider']>, false>>,
  Assert<Equal<ReturnType<typeof inferredContribution>, ReturnType<typeof explicitContribution>>>];
export const promisedKey = Symbol('promise'); export const promised = DiBag.createToken(promisedKey).forCollectionOf<Promise<number>>();
export const promiseBag = DiBag.createBuilder().withCollectionContribution({ collectionToken: promised, provider: DiBag.providerWithLifetime({ provider: DiBag.createProvider(() => Promise.resolve(1), { factoryReturnKind: 'uninspected' }), lifetime: 'scoped:one-per-container' }) }).buildContainer();
const promisedValues = promiseBag.resolveCollection(promised);
export type PromiseExact = Assert<Equal<typeof promisedValues, readonly Promise<number>[]>>;
const rootAliasFeature = DiBag.createBuilder().withServices({ helper: rooted }).withServiceAlias({ aliasKey: 'copy', targetServiceKey: 'helper' }).withCollectionContribution({ collectionToken: numbers, provider: DiBag.providerWithLifetime({ provider: ({ copy }: { copy: number }) => copy, lifetime: 'transient:one-per-resolve' }) }).buildModule({ exportedServiceKeys: [] });
DiBag.createBuilder().withInstalledModules([rootAliasFeature]).withServices({ rootAll }).buildContainer();
export const scopedAggregate = rootBag.createChildContainer();
export const rootedHelper = DiBag.createBuilder().withServices({ helper: rooted, rootAll: DiBag.providerWithLifetime({ provider: allProvider, lifetime: 'scoped:one-per-container' }) }).withCollectionContribution({ collectionToken: numbers, provider: DiBag.providerWithLifetime({ provider: ({ helper }: { helper: number }) => helper, lifetime: 'transient:one-per-resolve' }) }).buildContainer();
rootedHelper.createChildContainer(['rootAll'], { rootAll: DiBag.providerWithLifetime({ provider: allProvider, lifetime: 'singleton:one-per-container-tree' }) });
export const replacementContext = DiBag.createBuilder().withServices({ clock: DiBag.providerWithLifetime({ provider: (): { now(): number; unused(): boolean } => ({ now: () => 1, unused: () => true }), lifetime: 'scoped:one-per-container' }) }).withCollectionContribution({ collectionToken: numbers, provider: DiBag.providerWithLifetime({ provider: ({ clock }: { clock: { now(): number } }) => clock.now(), lifetime: 'scoped:one-per-container' }) }).withReplacedService('clock', DiBag.providerWithLifetime({ provider: (): { now(): number; extra(): boolean } => ({ now() { return 2; }, extra() { return true; } }), lifetime: 'scoped:one-per-container' })).buildContainer();
export const moduleReplacementContext = DiBag.createBuilder().withServices({ clock: DiBag.providerWithLifetime({ provider: (): { now(): number; unused(): boolean } => ({ now: () => 1, unused: () => true }), lifetime: 'scoped:one-per-container' }) }).withCollectionContribution({ collectionToken: numbers, provider: DiBag.providerWithLifetime({ provider: ({ clock }: { clock: { now(): number } }) => clock.now(), lifetime: 'scoped:one-per-container' }) }).withReplacedService('clock', DiBag.providerWithLifetime({ provider: (): { now(): number; extra(): boolean } => ({ now() { return 2; }, extra() { return true; } }), lifetime: 'scoped:one-per-container' })).buildModule({ exportedServiceKeys: [] });
export type ReplacementExact = Assert<Equal<ReturnType<typeof replacementContext.resolve<'clock'>>, { now(): number; extra(): boolean }>>;
export const sharedAliasBase = DiBag.createBuilder().withServices({ helper: rooted, consumer: DiBag.providerWithLifetime({ provider: allProvider, lifetime: 'scoped:one-per-container' }) }).withServiceAlias({ aliasKey: 'copy', targetServiceKey: 'helper' }).withCollectionContribution({ collectionToken: numbers, provider: DiBag.providerWithLifetime({ provider: ({ copy }: { copy: number }) => copy, lifetime: 'transient:one-per-resolve' }) }).buildContainer();
export const sharedAliasRoot = sharedAliasBase.createChildContainer(['consumer'], { consumer: rootAll }, { sharedParentServiceKeys: ['copy'] });
