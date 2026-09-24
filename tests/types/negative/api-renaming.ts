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
// diagnostic: no exported member 'AcquisitionContext'
import type { AcquisitionContext } from '../../../src';
// diagnostic: no exported member 'AcquisitionMode'
import type { AcquisitionMode } from '../../../src';
// diagnostic: no exported member 'CompositionArguments'
import type { CompositionArguments } from '../../../src';
// diagnostic: no exported member 'CompositionFunction'
import type { CompositionFunction } from '../../../src';
// diagnostic: no exported member 'PluginAcquisitionMode'
import type { PluginAcquisitionMode } from '../../../src';
// diagnostic: no exported member 'PluginOptions'
import type { PluginOptions } from '../../../src';
// diagnostic: no exported member named 'PluginProviderFactory'
import type { PluginProviderFactory } from '../../../src';
// diagnostic: no exported member
import type { FactoryWithDisposal } from '../../../src';
// diagnostic: no exported member
import type { Registration } from '../../../src';
// diagnostic: no exported member
import type { ReplacementInferenceContext } from '../../../src';
// diagnostic: does not exist
DiBag.withDisposal(() => 1, () => {});
// diagnostic: does not exist
DiBag.withLifetime(() => 1, 'root');
// diagnostic: does not exist
DiBag.withMetadata(() => 1, { static: {} });
// diagnostic: does not exist
DiBag.transformService(() => 1, { mode: 'direct', transform: (value: number) => value });
const base = DiBag.createProvider(() => Promise.resolve(1), { factoryReturnKind: 'uninspected' });
// diagnostic: No overload matches
DiBag.providerWithAcquisitionMetadata({ provider: base, describeAcquisition: (_value: Promise<number>) => ({}) });
// diagnostic: No overload matches
DiBag.providerWithAcquisitionMetadata({ provider: base, describeAcquisition: async () => ({}), callbackReceives: 'exposed-service' });
// diagnostic: No overload matches
DiBag.providerWithAcquisitionMetadata({ provider: base, describeAcquisition: async () => ({}), callbackReceives: 'fulfilled-value' });
// diagnostic: Property 'registrationMetadata' is missing
DiBag.providerWithRegistrationMetadata({ provider: base });
// diagnostic: duplicate metadata keys
DiBag.providerWithRegistrationMetadata({ provider: DiBag.providerWithRegistrationMetadata({ provider: base, registrationMetadata: { owner: 1 } }), registrationMetadata: { owner: 2 } });
// diagnostic: No overload matches
DiBag.providerWithTransformedService({ provider: base, transformService: value => value, callbackReceives: 'fulfilled-value', transformReturnKind: 'uninspected' });
// diagnostic: No overload matches
DiBag.createProvider(() => 1, { factoryReturnKind: 'native-promise' });
// diagnostic: not assignable
DiBag.createProvider((_deps: {}, _context: { signal: AbortSignal }) => 1);
// diagnostic: No overload matches
DiBag.providerWithTransformedService({ provider: base, transformService: () => 1, callbackReceives: 'exposed-service', transformReturnKind: 'native-promise' });
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
DiBag.createBuilder().withServices({ value: () => 1 })['buildModule'](['value']);

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
DiBag['withConfiguration']({ observers: [] });
const lifecycleObserver = { onLifecycleEvent() {}, onObserverFailure() {} } satisfies import('../../../src').LifecycleObserver;
// diagnostic: does not exist
lifecycleObserver.onEvent;
// diagnostic: does not exist
lifecycleObserver.onError;

// diagnostic: Property 'fromFactory' does not exist
DiBag.fromFactory;
// diagnostic: Property 'fromSyncFactory' does not exist
DiBag.fromSyncFactory;
// diagnostic: Property 'fromAsyncFactory' does not exist
DiBag.fromAsyncFactory;
// diagnostic: Property 'fromFunction' does not exist
DiBag.fromFunction;
// diagnostic: Property 'fromClass' does not exist
DiBag.fromClass;
// diagnostic: Property 'fromPlugin' does not exist
DiBag.fromPlugin;
// diagnostic: Property 'token' does not exist
DiBag.token;

const serviceSymbol = Symbol('service'); const token = DiBag.createToken(serviceSymbol);
// diagnostic: Property 'of' does not exist
token.of<number>();
const service = token.forService<number>();
// diagnostic: Property 'key' does not exist
service.key;

type RemovedContext = AcquisitionContext;
type RemovedMode = AcquisitionMode;
type RemovedArguments = CompositionArguments<[], []>;
type RemovedFunction = CompositionFunction<[]>;
type RemovedPluginMode = PluginAcquisitionMode;
type RemovedPluginOptions = PluginOptions<'raw', unknown>;
type RemovedPluginFactory = PluginProviderFactory;
// diagnostic: has no exported member
type RemovedCleanupError = import('../../../src').DiBagCleanupError;
// diagnostic: has no exported member
type RemovedCleanupFailure = import('../../../src').CleanupFailure;
