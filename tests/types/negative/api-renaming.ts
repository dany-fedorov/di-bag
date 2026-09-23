import { DiBag } from '../../../src';
// diagnostic: no exported member
import type { Bag } from '../../../src';
// diagnostic: no exported member
import type { ScopeOptions } from '../../../src';
// diagnostic: no exported member
import type { CheckedScopeLifetimes } from '../../../src';
// diagnostic: no exported member
import type { DisjointScopeSelection } from '../../../src';
// diagnostic: no exported member
import type { ObserverOptions } from '../../../src';
// diagnostic: no exported member
import type { BuilderContribute } from '../../../src';
const base = DiBag.createProvider(() => Promise.resolve(1), { factoryReturnKind: 'uninspected' });
// diagnostic: No overload matches
DiBag.withMetadata(base, { dynamic: { describe: (_value: Promise<number>) => ({}) } });
// diagnostic: No overload matches
DiBag.withMetadata(base, { dynamic: { mode: 'direct', describe: async () => ({}) } });
// diagnostic: No overload matches
DiBag.withMetadata(base, { dynamic: { mode: 'awaited', describe: async () => ({}) } });
// diagnostic: No overload matches
DiBag.withMetadata(base, {});
// diagnostic: No overload matches
DiBag.withMetadata(DiBag.withMetadata(base, { static: { owner: 1 } }), { static: { owner: 2 } });
// diagnostic: No overload matches
DiBag.transformService(base, { mode: 'awaited', acquisitionMode: 'uninspected', transform: value => value });
// diagnostic: No overload matches
DiBag.createProvider(() => 1, { factoryReturnKind: 'native-promise' });
// diagnostic: not assignable
DiBag.createProvider((_deps: {}, _context: { signal: AbortSignal }) => 1);
// diagnostic: No overload matches
DiBag.transformService(base, { mode: 'direct', acquisitionMode: 'native-promise', transform: () => 1 });
const numberKey = Symbol('number');
const number = DiBag.createToken(numberKey).forService<number>();
// diagnostic: positional factory arguments must match the declared parameter tuple
DiBag.createProviderFromFunction({ dependencies: [number], factoryFunction: () => 1 });
// diagnostic: token binding output is not assignable to its service
DiBag.createBuilder().withTokenService(number, () => 'wrong');
// diagnostic: does not exist
DiBag.begin();
// diagnostic: does not exist
DiBag.fromTokens([number], (_number: number) => 1);
// diagnostic: does not exist
DiBag.createBuilder().withServices({ value: () => 1 }).buildAndStart(['value']);
// diagnostic: has no exported member
type RemovedStartupOptions = import('../../../src').StartupOptions;
// diagnostic: has no exported member
type RemovedStartupError = import('../../../src').DiBagStartupError;
// diagnostic: has no exported member
type RemovedStartupCancelledError = import('../../../src').DiBagStartupCancelledError;
const removedCollectionKey = Symbol('removed collection');
const removedCollection = DiBag.createToken(removedCollectionKey).forCollectionOf<number>();
const removedBag = DiBag.createBuilder().withCollectionContribution({ collectionToken: removedCollection, provider: () => 1 }).buildContainer();
// diagnostic: Property 'all' does not exist
DiBag.all(removedCollection);
// diagnostic: Property 'resolveAll' does not exist
removedBag.resolveAll(removedCollection);
// diagnostic: Property 'inspectAll' does not exist
removedBag.inspectAll(removedCollection);
// diagnostic: has no exported member
type RemovedCollectionDependency = import('../../../src').CollectionDependency;

const retiredBuilder = DiBag.createBuilder();
// diagnostic: does not exist
retiredBuilder.register({ value: () => 1 });
// diagnostic: does not exist
retiredBuilder.alias('other', 'value');
// diagnostic: does not exist
retiredBuilder.contribute(number, () => 1);
// diagnostic: does not exist
retiredBuilder.replace('value', () => 2);
// diagnostic: does not exist
retiredBuilder.installModule({});
// diagnostic: does not exist
retiredBuilder.verifyGraph();
// diagnostic: does not exist
retiredBuilder.build();
// diagnostic: exportedServiceKeys
DiBag.createBuilder().withServices({ value: () => 1 }).buildModule(['value']);

const retiredContainer = DiBag.createBuilder().buildContainer();
// diagnostic: does not exist
retiredContainer.inspect('value');
// diagnostic: does not exist
retiredContainer.inspectCollection('value');
// diagnostic: does not exist
retiredContainer.inspectGraph();
// diagnostic: does not exist
retiredContainer.createScope();
// diagnostic: does not exist
retiredContainer.fork();

const moduleForRename = DiBag.createBuilder().withServices({ value: () => 1 }).buildModule({ exportedServiceKeys: ['value'] });
// diagnostic: does not exist
moduleForRename.renameExport('value', 'other');
// diagnostic: does not exist
DiBag.withConfiguration({ observers: [] });
const lifecycleObserver = { onLifecycleEvent() {}, onObserverFailure() {} } satisfies import('../../../src').LifecycleObserver;
// diagnostic: does not exist
lifecycleObserver.onEvent;
// diagnostic: does not exist
lifecycleObserver.onError;
