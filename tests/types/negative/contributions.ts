import { DiBag, type Builder, type Container } from '../../../src';
const key = Symbol('numbers'); const numbers = DiBag.createToken(key).forCollectionOf<number>();
const wrong = DiBag.createToken(key).forCollectionOf<string>();
// diagnostic: collection contribution output is not assignable to its item
DiBag.createBuilder().withCollectionContribution({ collectionToken: numbers, provider: () => 'wrong' });
const builder = DiBag.createBuilder().withCollectionContribution({ collectionToken: numbers, provider: () => 1 });
// diagnostic: incompatible
builder.withCollectionContribution({ collectionToken: wrong, provider: () => 'wrong' });
// diagnostic: incompatible
builder.buildContainer().resolveCollection(wrong);
// diagnostic: incompatible
builder.buildContainer().serviceSnapshot(wrong);
// diagnostic: required service registrations are missing
DiBag.createBuilder().withCollectionContribution({ collectionToken: numbers, provider: ({ missing }: { missing: number }) => missing }).buildContainer();
// diagnostic: not assignable
const erasedBuilder: Builder<never> = builder;
// diagnostic: not assignable
const erasedBag: Container<{}> = builder.buildContainer();
const all = numbers;
const rootAll = DiBag.providerWithLifetime({ provider: DiBag.createProviderFromFunction({ dependencies: [all], factoryFunction: values => values }), lifetime: 'singleton:one-per-container-tree' });
// diagnostic: root lifetime cannot capture scoped dependency
builder.withServices({ rootAll }).buildContainer();
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().withCollectionContribution({ collectionToken: numbers, provider: DiBag.providerWithLifetime({ provider: ({ helper }: { helper: number }) => helper, lifetime: 'singleton:one-per-container-tree' }) }).withServices({ helper: () => 1 }).buildContainer();
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().withCollectionContribution({ collectionToken: numbers, provider: DiBag.providerWithLifetime({ provider: ({ helper }: { helper: number }) => helper, lifetime: 'transient:one-per-resolve' }) }).withServices({ helper: () => 1, rootAll }).buildContainer();
const privateScoped = DiBag.createBuilder().withServices({ helper: () => 1 }).withCollectionContribution({ collectionToken: numbers, provider: DiBag.providerWithLifetime({ provider: ({ helper }: { helper: number }) => helper, lifetime: 'transient:one-per-resolve' }) }).buildModule({ exportedServiceKeys: [] });
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().withInstalledModules([privateScoped]).withServices({ rootAll }).buildContainer();
const privateRootBuilder = DiBag.createBuilder().withServices({ helper: () => 1 }).withCollectionContribution({ collectionToken: numbers, provider: DiBag.providerWithLifetime({ provider: ({ helper }: { helper: number }) => helper, lifetime: 'singleton:one-per-container-tree' }) });
// diagnostic: root lifetime cannot capture scoped dependency: contribution -> helper
privateRootBuilder.buildModule({ exportedServiceKeys: [] });
// diagnostic: incompatible
DiBag.createBuilder().withServices({ all: DiBag.createProviderFromFunction({ dependencies: [all], factoryFunction: values => values }) }).withCollectionContribution({ collectionToken: wrong, provider: () => 'wrong' });
// diagnostic: incompatible
builder.withServices({ all: DiBag.createProviderFromFunction({ dependencies: [wrong], factoryFunction: values => values }) });
const privateAll = DiBag.createBuilder().withServices({ privateAll: DiBag.createProviderFromFunction({ dependencies: [all], factoryFunction: values => values }) }).buildModule({ exportedServiceKeys: [] });
// diagnostic: incompatible
DiBag.createBuilder().withInstalledModules([privateAll]).withCollectionContribution({ collectionToken: wrong, provider: () => 'wrong' });
// diagnostic: incompatible
DiBag.createBuilder().withCollectionContribution({ collectionToken: wrong, provider: () => 'wrong' }).withInstalledModules([privateAll]);
// diagnostic: incompatible
DiBag.createBuilder().withCollectionContribution({ collectionToken: numbers, provider: () => 1 }).withServices({ all: DiBag.createProviderFromFunction({ dependencies: [wrong], factoryFunction: values => values }) });
// diagnostic: required service registrations are missing
DiBag.createBuilder().withInstalledModules([DiBag.createBuilder().withCollectionContribution({ collectionToken: numbers, provider: ({ missing }: { missing: number }) => missing }).buildModule({ exportedServiceKeys: [] })]).buildContainer();
// diagnostic: contribution service is incompatible with its consumer dependency contract; see https://dany-fedorov.github.io/di-bag/agent/errors.html#unsatisfied-consumer
DiBag.createBuilder().withCollectionContribution({ collectionToken: numbers, provider: ({ value }: { value: number }) => value }).withServices({ value: () => 'bad' });
// diagnostic: consumer dependency
DiBag.createBuilder().withCollectionContribution({ collectionToken: numbers, provider: ({ value }: { value: number }) => value }).withServices({ value: () => 'bad' });
const dependency = DiBag.createBuilder().withServices({ helper: () => 1 }).withCollectionContribution({ collectionToken: numbers, provider: ({ helper }: { helper: number }) => helper });
// diagnostic: consumer dependency
dependency.withReplacedService<'helper', () => string>('helper', () => 'wrong');
// diagnostic: not assignable
const erasedModule: ReturnType<ReturnType<typeof DiBag.createBuilder>['buildModule']> = DiBag.createBuilder().withCollectionContribution({ collectionToken: numbers, provider: () => 1 }).buildModule({ exportedServiceKeys: [] });
// diagnostic: not assignable
const erasedModuleBuilder: ReturnType<typeof DiBag.createBuilder> = DiBag.createBuilder().withCollectionContribution({ collectionToken: numbers, provider: () => 1 });
// diagnostic: not assignable
builder.buildContainer().resolveCollection({});
// diagnostic: optional requires a single-service token
DiBag.optional(numbers);
// diagnostic: Expected 2 arguments
builder.withCollectionContribution<never, () => number>({ collectionToken: numbers as never, provider: () => 1 });
// diagnostic: Expected 2 arguments
builder.withCollectionContribution<typeof numbers, never>({ collectionToken: numbers, provider: undefined as never });
declare const erased: import('../../../src').ProviderOrFactory;
// diagnostic: not assignable
builder.withCollectionContribution({ collectionToken: numbers, provider: erased });
const otherKey = Symbol('other'); const other = DiBag.createToken(otherKey).forCollectionOf<number>();
declare const union: typeof numbers | typeof other;
// diagnostic: finite tuple
builder.withCollectionContribution({ collectionToken: union, provider: () => 1 });
// diagnostic: finite tuple
builder.buildContainer().resolveCollection(union);
// diagnostic: finite tuple
builder.buildContainer().serviceSnapshot(union);
declare const incompatibleUnion: typeof numbers | typeof wrong;
// diagnostic: finite tuple
builder.buildContainer().resolveCollection(incompatibleUnion);
// diagnostic: finite tuple
builder.buildContainer().serviceSnapshot(incompatibleUnion);
const otherWrong = DiBag.createToken(key).forCollectionOf<boolean>();
declare const allIncompatibleUnion: typeof wrong | typeof otherWrong;
// diagnostic: finite tuple
builder.buildContainer().resolveCollection(allIncompatibleUnion);
// diagnostic: finite tuple
builder.buildContainer().serviceSnapshot(allIncompatibleUnion);
const collectionReflected: import('../../../src').CollectionTokenBase = numbers;
// diagnostic: individually known
builder.buildContainer().resolveCollection(collectionReflected);
// diagnostic: finite tuple
DiBag.createProviderFromFunction({ dependencies: [collectionReflected], factoryFunction: values => values });
declare const reflected: ReturnType<typeof builder.withCollectionContribution>;
// diagnostic: required service registrations are missing
reflected.buildContainer();
// diagnostic: not assignable
const badInspection: readonly { metadata: { label: string } }[] = builder.buildContainer().serviceSnapshot(numbers);

const privateTransientHelper = DiBag.createBuilder().withServices({ leaf: () => 1, helper: DiBag.providerWithLifetime({ provider: ({ leaf }: { leaf: number }) => leaf, lifetime: 'transient:one-per-resolve' }) }).withCollectionContribution({ collectionToken: numbers, provider: DiBag.providerWithLifetime({ provider: ({ helper }: { helper: number }) => helper, lifetime: 'transient:one-per-resolve' }) }).buildModule({ exportedServiceKeys: [] });
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().withInstalledModules([privateTransientHelper]).withServices({ rootAll }).buildContainer();
const scopedBag = builder.withServices({ consumer: DiBag.createProviderFromFunction({ dependencies: [all], factoryFunction: values => values }) }).buildContainer();
// diagnostic: root lifetime cannot capture scoped dependency
scopedBag.createChildContainer(['consumer'], { consumer: rootAll });
// diagnostic: root lifetime cannot capture scoped dependency
scopedBag.createIndependentContainer(['consumer'], { consumer: rootAll });
const scopedAliasFeature = DiBag.createBuilder().withServices({ helper: () => 1 }).withServiceAlias({ aliasKey: 'copy', targetServiceKey: 'helper' }).withCollectionContribution({ collectionToken: numbers, provider: DiBag.providerWithLifetime({ provider: ({ copy }: { copy: number }) => copy, lifetime: 'transient:one-per-resolve' }) }).buildModule({ exportedServiceKeys: [] });
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().withInstalledModules([scopedAliasFeature]).withServices({ rootAll }).buildContainer();
const needsTwo = DiBag.createBuilder().withCollectionContribution({ collectionToken: numbers, provider: ({ external }: { external: number }) => external }).withCollectionContribution({ collectionToken: numbers, provider: ({ external }: { external: string }) => external.length }).buildModule({ exportedServiceKeys: [] });
// diagnostic: consumer dependency
DiBag.createBuilder().withInstalledModules([needsTwo]).withServices({ external: () => 1 });
const tokenKey = Symbol('dependency'); const required = DiBag.createToken(tokenKey).forService<number>(); const wrongRequired = DiBag.createToken(tokenKey).forService<string>();
// diagnostic: incompatible
DiBag.createBuilder().withCollectionContribution({ collectionToken: numbers, provider: DiBag.createProviderFromFunction({ dependencies: [DiBag.optional(required)], factoryFunction: value => value ?? 0 }) }).withTokenService(wrongRequired, () => 'wrong');
// diagnostic: required service registrations are missing
DiBag.createBuilder().withCollectionContribution({ collectionToken: numbers, provider: DiBag.createProviderFromFunction({ dependencies: [DiBag.lazy(required)], factoryFunction: get => get() }) }).buildContainer();
// diagnostic: incompatible
DiBag.createBuilder().withCollectionContribution({ collectionToken: numbers, provider: DiBag.createProviderFromFunction({ dependencies: [DiBag.lazy(required)], factoryFunction: get => get() }) }).withTokenService(wrongRequired, () => 'wrong');
// diagnostic: required service registrations are missing
DiBag.createBuilder().withInstalledModules([DiBag.createBuilder().withCollectionContribution({ collectionToken: numbers, provider: DiBag.createProviderFromFunction({ dependencies: [required], factoryFunction: value => value }) }).buildModule({ exportedServiceKeys: [] })]).buildContainer();
// diagnostic: incompatible
DiBag.createBuilder().withInstalledModules([DiBag.createBuilder().withCollectionContribution({ collectionToken: numbers, provider: DiBag.createProviderFromFunction({ dependencies: [wrong], factoryFunction: values => values.length }) }).buildModule({ exportedServiceKeys: [] })]).withCollectionContribution({ collectionToken: numbers, provider: () => 1 });
// diagnostic: not assignable
const forgedToken: Parameters<typeof builder.withCollectionContribution>[0]['collectionToken'] = numbers;
// diagnostic: Expected 2 arguments
builder.buildContainer().resolveCollection<never>(numbers as never);
// diagnostic: Expected 2 arguments
builder.buildContainer().serviceSnapshot<never>(numbers as never);
// diagnostic: Expected 2 arguments
builder.buildContainer().serviceSnapshot<never>(numbers as never);
const rooted = DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'singleton:one-per-container-tree' });
const sharedAliasBase = DiBag.createBuilder().withServices({ helper: () => 1, consumer: DiBag.createProviderFromFunction({ dependencies: [all], factoryFunction: values => values }) }).withServiceAlias({ aliasKey: 'copy', targetServiceKey: 'helper' }).withCollectionContribution({ collectionToken: numbers, provider: DiBag.providerWithLifetime({ provider: ({ copy }: { copy: number }) => copy, lifetime: 'transient:one-per-resolve' }) }).buildContainer();
// diagnostic: root lifetime cannot capture scoped dependency
sharedAliasBase.createChildContainer(['helper', 'consumer'], { helper: rooted, consumer: rootAll }, { sharedParentServiceKeys: ['copy'] });
const sharedRootAliasBase = DiBag.createBuilder().withServices({ helper: rooted, consumer: DiBag.createProviderFromFunction({ dependencies: [all], factoryFunction: values => values }) }).withServiceAlias({ aliasKey: 'copy', targetServiceKey: 'helper' }).withCollectionContribution({ collectionToken: numbers, provider: DiBag.providerWithLifetime({ provider: ({ copy }: { copy: number }) => copy, lifetime: 'transient:one-per-resolve' }) }).buildContainer();
// diagnostic: createChildContainer cannot replace singleton service: helper
sharedRootAliasBase.createChildContainer(['helper', 'consumer'], { helper: () => 2, consumer: rootAll }, { sharedParentServiceKeys: ['copy'] });
const scopedHelperFork = sharedRootAliasBase.createIndependentContainer(['helper'], { helper: () => 2 });
// diagnostic: root lifetime cannot capture scoped dependency
scopedHelperFork.createIndependentContainer(['consumer'], { consumer: rootAll });
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().withCollectionContribution({ collectionToken: numbers, provider: rooted }).withCollectionContribution({ collectionToken: numbers, provider: () => 1 }).withServices({ rootAll }).buildContainer();
