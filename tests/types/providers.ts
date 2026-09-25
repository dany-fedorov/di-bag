import { DiBag, type Module, type Provider, type ProviderOutput, type ProviderNamedDependencies, type ProviderRegistrationMetadata, type ProviderAcquisitionMetadata, type ProviderOrFactory, type Presence, type AcquisitionMetadataPresence, type AcquisitionSnapshot } from '../../src';
import type { Assert, Equal } from './assert';
import type { ProviderFactory } from '../../src/provider';
type Registration = ProviderOrFactory;

const create = ({ clock }: { clock: { now(): number } }) => ({ read: () => clock.now() });
const decorated = DiBag.providerWithRegistrationMetadata({ provider: create, registrationMetadata: { 'app:owner': { team: 'platform' } } });
const exact: Provider<typeof create, Readonly<{ 'app:owner': { team: string } }>, readonly []> = decorated;
type Output = Assert<Equal<ProviderOutput<typeof decorated>, { read(): number }>>;
type Needs = Assert<Equal<ProviderNamedDependencies<typeof decorated>, { clock: { now(): number } }>>;
type Metadata = Assert<Equal<ProviderRegistrationMetadata<typeof decorated>, Readonly<{ 'app:owner': { team: string } }>>>;
type Frames = Assert<Equal<ProviderAcquisitionMetadata<typeof decorated>, readonly []>>;
const unit = DiBag.createBuilder().withServices({ service: decorated }).buildModule({ exportedServiceKeys: ['service'] });
const renamed = unit.withRenamedExport({ currentExportKey: 'service', newExportKey: 'client' });
const bag = DiBag.createBuilder().withInstalledModules([renamed]).withServices({ clock: () => ({ now: () => 42 }) }).buildContainer();
const team: string = bag.serviceSnapshot('client').registrationMetadata['app:owner'].team;
const value: number = bag.resolve('client').read();
type PublicNeeds = typeof unit extends Module<infer _P, infer _R, infer _C, infer D> ? ProviderNamedDependencies<D[Extract<'service', keyof D>]> : never;
type NoPrivateNeeds = Assert<Equal<PublicNeeds, Record<never, never>>>;
const owned = DiBag.providerWithRegistrationMetadata({ provider: DiBag.providerWithDisposal({ provider: async () => 42, disposeService: value => { const n: number = value; void n; } }), registrationMetadata: {} });
type PromiseOutput = Assert<Equal<ProviderOutput<typeof owned>, Promise<number>>>;
const plain: Module<{ value: number }, {}> = DiBag.createBuilder().withServices({ value: DiBag.providerWithRegistrationMetadata({ provider: () => 1, registrationMetadata: {} }) }).buildModule({ exportedServiceKeys: ['value'] });
const child = bag.createIndependentContainer(['clock', 'client'], {
  clock: DiBag.providerWithRegistrationMetadata({ provider: () => ({ now() { return 7; }, zone() { return 'utc' as const; } }), registrationMetadata: { owner: 'child' } }),
  client: ({ clock }: { clock: { now(): number; zone(): 'utc' } }) => ({ read() { return clock.now(); }, zone() { return clock.zone(); } }),
});
type Zone = Assert<Equal<ReturnType<typeof child.resolve<'client'>>, { read(): number; zone(): 'utc' }>>;
const replaced = DiBag.createBuilder().withServices({ value: () => 1 }).withReplacedService('value', DiBag.providerWithRegistrationMetadata({ provider: () => ({ read() { return 7; } }), registrationMetadata: { owner: 'replacement' } })).buildContainer();
type Replaced = Assert<Equal<ReturnType<typeof replaced.resolve<'value'>>, { read(): 7 }>>;
const alternate = DiBag.providerWithRegistrationMetadata({ provider: () => 2, registrationMetadata: { owner: 'alternate' } });
const either = Math.random() > 0.5 ? alternate : () => 1;
const unionReplaced = DiBag.createBuilder().withServices({ value: () => 0 }).withReplacedService('value', either).buildContainer();
type UnionReplacement = Assert<Equal<ReturnType<typeof unionReplaced.resolve<'value'>>, number>>;
const moduleReplaced = DiBag.createBuilder().withServices({ value: () => 0 }).withReplacedService('value', either).buildModule({ exportedServiceKeys: ['value'] });
const moduleInstalled = DiBag.createBuilder().withInstalledModules([moduleReplaced]).buildContainer();
type UnionModuleReplacement = Assert<Equal<ReturnType<typeof moduleInstalled.resolve<'value'>>, number>>;
declare const metadataChoice: { first: number } | { second: string };
const choiceProvider = DiBag.providerWithRegistrationMetadata({ provider: () => 1, registrationMetadata: metadataChoice });
const choiceBag = DiBag.createBuilder().withInstalledModules([DiBag.createBuilder().withServices({ choice: choiceProvider }).buildModule({ exportedServiceKeys: ['choice'] })]).buildContainer();
const choiceMetadata = choiceBag.serviceSnapshot('choice').registrationMetadata;
type ChoiceMetadata = Assert<Equal<typeof choiceMetadata, Readonly<{ first: number } | { second: string }>>>;
type Opaque = Exclude<Registration, ((...args: never[]) => unknown) | { create: unknown }>;
type OpaqueOutput = Assert<Equal<ProviderOutput<Opaque>, unknown>>;
type OpaqueNeeds = Assert<Equal<ProviderNamedDependencies<Opaque>, unknown>>;
type WrappedOpaqueNeeds = Assert<Equal<ProviderNamedDependencies<NoInfer<Registration>>, unknown>>;
type WrappedOpaqueOutput = Assert<Equal<ProviderOutput<NoInfer<Registration>>, unknown>>;
type PresenceContract = Assert<Equal<Presence<string>, { readonly isPresent: false } | { readonly isPresent: true; readonly value: string }>>;
type Tuple = Assert<Equal<AcquisitionMetadataPresence<readonly [string, number]>, readonly [Presence<string>, Presence<number>]>>;
declare const attempt: AcquisitionSnapshot<readonly [string]>;
if (attempt.acquisitionMetadata[0].isPresent) { const text: string = attempt.acquisitionMetadata[0].value; void text; }
declare const framed: Provider<() => number, Readonly<{ owner: string }>, readonly [{ kind: 'trace'; id: string }]>;
const frameUnit = DiBag.createBuilder().withServices({ framed }).buildModule({ exportedServiceKeys: ['framed'] }).withRenamedExport({ currentExportKey: 'framed', newExportKey: 'traced' });
const frameView = DiBag.createBuilder().withInstalledModules([frameUnit]).buildContainer().serviceSnapshot('traced');
type RetainedFrame = Assert<Equal<typeof frameView.acquisitions, readonly AcquisitionSnapshot<readonly [{ kind: 'trace'; id: string }]>[]>>;
void [exact, team, value, plain];

const mapped = DiBag.providerWithTransformedService({ provider: decorated, transformService: value => ({ result: value.read() }), callbackReceives: 'exposed-service' });
type MappedOutput = Assert<Equal<ProviderOutput<typeof mapped>, { result: number }>>;
type MappedNeeds = Assert<Equal<ProviderNamedDependencies<typeof mapped>, ProviderNamedDependencies<typeof decorated>>>;
type MappedMetadata = Assert<Equal<ProviderRegistrationMetadata<typeof mapped>, ProviderRegistrationMetadata<typeof decorated>>>;
const asyncMapped = DiBag.providerWithTransformedService({ provider: owned, transformService: value => Promise.resolve({ result: value }), callbackReceives: 'fulfilled-value' });
type AsyncMappedOutput = Assert<Equal<ProviderOutput<typeof asyncMapped>, Promise<{ result: number }>>>;
const syncPromise = DiBag.providerWithTransformedService({ provider: owned, transformService: value => { const exact: Promise<number> = value; return exact; }, callbackReceives: 'exposed-service' });
type ExactMappedPromise = Assert<Equal<ProviderOutput<typeof syncPromise>, Promise<number>>>;
const framedMapped = DiBag.providerWithDisposal({ provider: DiBag.providerWithTransformedService({ provider: framed, transformService: value => ({ value }), callbackReceives: 'fulfilled-value' }), disposeService: value => {
  const exact: number = value.value; void exact;
} });
type MappedFrames = Assert<Equal<ProviderAcquisitionMetadata<typeof framedMapped>, readonly [{ kind: 'trace'; id: string }]>>;
type OwnedMappedMetadata = Assert<Equal<ProviderRegistrationMetadata<typeof framedMapped>, Readonly<{ owner: string }>>>;
const legacyCreate = ({ clock }: { clock: number }) => ({ read() { return clock; } });
const legacyOwned = DiBag.providerWithDisposal({ provider: legacyCreate, disposeService: value => { const n: number = value.read(); void n; } });
type OriginalCreate = Assert<Equal<ProviderFactory<typeof legacyOwned>, typeof legacyCreate>>;
const mappedModule = DiBag.createBuilder().withServices({ clock: () => ({ now: () => 42 }), mapped }).buildModule({ exportedServiceKeys: ['mapped'] }).withRenamedExport({ currentExportKey: 'mapped', newExportKey: 'result' });
const mappedBag = DiBag.createBuilder().withInstalledModules([mappedModule]).buildContainer();
type InstalledMapping = Assert<Equal<ReturnType<typeof mappedBag.resolve<'result'>>, { result: number }>>;
const mappingReplacement = DiBag.createBuilder().withServices({ value: () => 1 }).withReplacedService('value', DiBag.providerWithTransformedService({ provider: () => 1, transformService: value => ({ value }), callbackReceives: 'exposed-service' })).buildContainer();
type MappingReplacement = Assert<Equal<ReturnType<typeof mappingReplacement.resolve<'value'>>, { value: number }>>;
const mappingFork = bag.createIndependentContainer(['clock'], { clock: DiBag.providerWithTransformedService({ provider: () => 7, transformService: value => ({ now() { return value; } }), callbackReceives: 'exposed-service' }) });
type MappingFork = Assert<Equal<ReturnType<typeof mappingFork.resolve<'clock'>>, { now(): number }>>;
declare const erasedRegistration: NoInfer<Registration>;
const erasedSync = DiBag.providerWithTransformedService({ provider: erasedRegistration, transformService: value => { const unknown: unknown = value; return unknown; }, callbackReceives: 'exposed-service' });
const erasedAsync = DiBag.providerWithTransformedService({ provider: erasedRegistration, transformService: value => value, callbackReceives: 'fulfilled-value' });
const erasedOwned = DiBag.providerWithDisposal({ provider: erasedRegistration, disposeService: value => { const unknown: unknown = value; void unknown; } });
type ErasedSyncNeeds = Assert<Equal<ProviderNamedDependencies<typeof erasedSync>, unknown>>;
type ErasedSyncOutput = Assert<Equal<ProviderOutput<typeof erasedSync>, unknown>>;
type ErasedAsyncNeeds = Assert<Equal<ProviderNamedDependencies<typeof erasedAsync>, unknown>>;
type ErasedAsyncOutput = Assert<Equal<ProviderOutput<typeof erasedAsync>, Promise<unknown>>>;
type ErasedOwnedNeeds = Assert<Equal<ProviderNamedDependencies<typeof erasedOwned>, unknown>>;
type ErasedOwnedOutput = Assert<Equal<ProviderOutput<typeof erasedOwned>, unknown>>;
const exactSameObject = DiBag.providerWithDisposal({ provider: legacyOwned, disposeService: value => { const n: number = value.read(); void n; } });
type AdditiveOwnedOutput = Assert<Equal<ProviderOutput<typeof exactSameObject>, { read(): number }>>;
const unionMapped = DiBag.providerWithTransformedService({ provider: choiceProvider, transformService: value => String(value), callbackReceives: 'exposed-service' });
type UnionMappedMetadata = Assert<Equal<ProviderRegistrationMetadata<typeof unionMapped>, Readonly<{ first: number } | { second: string }>>>;

// Mixed registration kinds must distribute even behind a no-back-inference boundary.
const mixedPlain = ({ plain }: { plain: string }) => plain;
const mixedOwnedFactory = ({ owned }: { owned: boolean }) => owned;
const mixedOwned = DiBag.providerWithDisposal({ provider: mixedOwnedFactory, disposeService: () => {} });
declare const mixedFramed: Provider<({ framed }: { framed: number }) => number,
  Readonly<{ owner: string }>, readonly [{ kind: 'first' }, { kind: 'second' }]>;
type Mixed = typeof mixedPlain | typeof mixedOwned | typeof mixedFramed;
type MixedFactories = typeof mixedPlain | typeof mixedOwnedFactory | (({ framed }: { framed: number }) => number);
type MixedNeeds = { plain: string } | { owned: boolean } | { framed: number };
type MixedMetadata = Readonly<{}> | Readonly<{ owner: string }>;
type MixedFrames = readonly [] | readonly [{ kind: 'first' }, { kind: 'second' }];
type PlainUnion = (() => 'empty') | ((deps: { dep: boolean }) => 42);
type PlainUnionContracts = [
  Assert<Equal<ProviderFactory<PlainUnion>, PlainUnion>>,
  Assert<Equal<ProviderFactory<NoInfer<PlainUnion>>, PlainUnion>>,
  Assert<Equal<ProviderOutput<PlainUnion>, 'empty' | 42>>,
  Assert<Equal<ProviderOutput<NoInfer<PlainUnion>>, 'empty' | 42>>,
  Assert<Equal<ProviderNamedDependencies<PlainUnion>, { dep: boolean }>>,
  Assert<Equal<ProviderNamedDependencies<NoInfer<PlainUnion>>, { dep: boolean }>>,
];
type MixedContracts = [
  Assert<Equal<ProviderFactory<Mixed>, MixedFactories>>,
  Assert<Equal<ProviderFactory<NoInfer<Mixed>>, MixedFactories>>,
  Assert<Equal<ProviderOutput<Mixed>, string | boolean | number>>,
  Assert<Equal<ProviderOutput<NoInfer<Mixed>>, string | boolean | number>>,
  Assert<Equal<ProviderNamedDependencies<Mixed>, MixedNeeds>>,
  Assert<Equal<ProviderNamedDependencies<NoInfer<Mixed>>, MixedNeeds>>,
  Assert<Equal<ProviderRegistrationMetadata<Mixed>, MixedMetadata>>,
  Assert<Equal<ProviderRegistrationMetadata<NoInfer<Mixed>>, MixedMetadata>>,
  Assert<Equal<ProviderAcquisitionMetadata<Mixed>, MixedFrames>>,
  Assert<Equal<ProviderAcquisitionMetadata<NoInfer<Mixed>>, MixedFrames>>,
  Assert<Equal<ProviderFactory<NoInfer<typeof mixedFramed | typeof mixedOwned | typeof mixedPlain>>, MixedFactories>>,
  Assert<Equal<ProviderFactory<NoInfer<typeof mixedOwned | typeof mixedPlain | typeof mixedFramed>>, MixedFactories>>,
  Assert<Equal<ProviderFactory<NoInfer<typeof mixedPlain | typeof mixedOwned>>, typeof mixedPlain | typeof mixedOwnedFactory>>,
  Assert<Equal<ProviderFactory<NoInfer<typeof mixedPlain | typeof mixedFramed>>, typeof mixedPlain | (({ framed }: { framed: number }) => number)>>,
  Assert<Equal<ProviderFactory<NoInfer<typeof mixedOwned | typeof mixedFramed>>, typeof mixedOwnedFactory | (({ framed }: { framed: number }) => number)>>,
  Assert<Equal<ProviderFactory<NoInfer<() => never>>, () => never>>,
  Assert<Equal<ProviderOutput<NoInfer<() => never>>, never>>,
  Assert<Equal<ProviderNamedDependencies<NoInfer<() => never>>, Record<never, never>>>,
  Assert<Equal<ProviderOutput<NoInfer<Mixed | Opaque>>, unknown>>,
  Assert<Equal<ProviderNamedDependencies<NoInfer<Mixed | Opaque>>, unknown>>,
  Assert<Equal<ProviderRegistrationMetadata<NoInfer<Mixed | Opaque>>, unknown>>,
  Assert<Equal<ProviderAcquisitionMetadata<NoInfer<Mixed | Opaque>>, readonly unknown[]>>,
];
declare const mixed: Mixed;
const mixedMapped = DiBag.providerWithTransformedService({ provider: mixed, transformService: value => {
  type Input = Assert<Equal<typeof value, string | boolean | number>>;
  return { text: String(value) };
}, callbackReceives: 'exposed-service' });
const mixedAsync = DiBag.providerWithTransformedService({ provider: mixed, transformService: value => {
  type Input = Assert<Equal<typeof value, string | boolean | number>>;
  return Promise.resolve(String(value));
}, callbackReceives: 'fulfilled-value' });
const mixedDisposed = DiBag.providerWithDisposal({ provider: mixed, disposeService: value => {
  type Input = Assert<Equal<typeof value, string | boolean | number>>;
} });
const mixedAnnotated = DiBag.providerWithRegistrationMetadata({ provider: mixed, registrationMetadata: { extra: true } });
type MixedTransforms = [
  Assert<Equal<ProviderOutput<typeof mixedMapped>, { text: string }>>,
  Assert<Equal<ProviderOutput<typeof mixedAsync>, Promise<string>>>,
  Assert<Equal<ProviderOutput<typeof mixedDisposed>, string | boolean | number>>,
  Assert<Equal<ProviderNamedDependencies<typeof mixedMapped>, MixedNeeds>>,
  Assert<Equal<ProviderNamedDependencies<typeof mixedAsync>, MixedNeeds>>,
  Assert<Equal<ProviderNamedDependencies<typeof mixedDisposed>, MixedNeeds>>,
  Assert<Equal<ProviderRegistrationMetadata<typeof mixedMapped>, MixedMetadata>>,
  Assert<Equal<ProviderRegistrationMetadata<typeof mixedAnnotated>, Readonly<MixedMetadata & { extra: boolean }>>>,
  Assert<Equal<ProviderAcquisitionMetadata<typeof mixedMapped>, MixedFrames>>,
  Assert<Equal<ProviderAcquisitionMetadata<typeof mixedDisposed>, MixedFrames>>,
  Assert<Equal<ProviderAcquisitionMetadata<typeof mixedAnnotated>, MixedFrames>>,
];
