import { DiBag, type Module, type Provider, type ProviderOutput, type ProviderNeeds, type ProviderMetadata, type ProviderAcquisitionMetadata, type Presence, type FramePresenceTuple, type AcquisitionSnapshot } from '../../src';
import type { Assert, Equal } from './assert';
import type { ProviderFactory } from '../../src/provider';
type Registration = Parameters<typeof DiBag.withMetadata>[0];

const create = ({ clock }: { clock: { now(): number } }) => ({ read: () => clock.now() });
const decorated = DiBag.withMetadata(create, { 'app:owner': { team: 'platform' } });
const exact: Provider<typeof create, Readonly<{ 'app:owner': { team: string } }>, readonly []> = decorated;
type Output = Assert<Equal<ProviderOutput<typeof decorated>, { read(): number }>>;
type Needs = Assert<Equal<ProviderNeeds<typeof decorated>, { clock: { now(): number } }>>;
type Metadata = Assert<Equal<ProviderMetadata<typeof decorated>, Readonly<{ 'app:owner': { team: string } }>>>;
type Frames = Assert<Equal<ProviderAcquisitionMetadata<typeof decorated>, readonly []>>;
const unit = DiBag.module().add({ service: decorated }).exports(['service']);
const renamed = unit.rename('service', 'client');
const bag = DiBag.begin().install(renamed).add({ clock: () => ({ now: () => 42 }) }).end();
const team: string = bag.inspect('client').metadata['app:owner'].team;
const value: number = bag.resolve('client').read();
type PublicNeeds = typeof unit extends Module<infer _P, infer _R, infer _C, infer D> ? ProviderNeeds<D[Extract<'service', keyof D>]> : never;
type NoPrivateNeeds = Assert<Equal<PublicNeeds, Record<never, never>>>;
const owned = DiBag.withMetadata(DiBag.withDisposal(async () => 42, value => { const n: number = value; void n; }), {});
type PromiseOutput = Assert<Equal<ProviderOutput<typeof owned>, Promise<number>>>;
const plain: Module<{ value: number }, {}> = DiBag.module().add({ value: DiBag.withMetadata(() => 1, {}) }).exports(['value']);
const child = bag.fork(['clock', 'client'], {
  clock: DiBag.withMetadata(() => ({ now() { return 7; }, zone() { return 'utc' as const; } }), { owner: 'child' }),
  client: ({ clock }: { clock: { now(): number; zone(): 'utc' } }) => ({ read() { return clock.now(); }, zone() { return clock.zone(); } }),
});
type Zone = Assert<Equal<ReturnType<typeof child.resolve<'client'>>, { read(): number; zone(): 'utc' }>>;
const replaced = DiBag.begin().add({ value: () => 1 }).replace('value', DiBag.withMetadata(() => ({ read() { return 7; } }), { owner: 'replacement' })).end();
type Replaced = Assert<Equal<ReturnType<typeof replaced.resolve<'value'>>, { read(): number }>>;
const alternate = DiBag.withMetadata(() => 2, { owner: 'alternate' });
const either = Math.random() > 0.5 ? alternate : () => 1;
const unionReplaced = DiBag.begin().add({ value: () => 0 }).replace('value', either).end();
type UnionReplacement = Assert<Equal<ReturnType<typeof unionReplaced.resolve<'value'>>, number>>;
const moduleReplaced = DiBag.module().add({ value: () => 0 }).replace('value', either).exports(['value']);
const moduleInstalled = DiBag.begin().install(moduleReplaced).end();
type UnionModuleReplacement = Assert<Equal<ReturnType<typeof moduleInstalled.resolve<'value'>>, number>>;
declare const metadataChoice: { first: number } | { second: string };
const choiceProvider = DiBag.withMetadata(() => 1, metadataChoice);
const choiceBag = DiBag.begin().install(DiBag.module().add({ choice: choiceProvider }).exports(['choice'])).end();
const choiceMetadata = choiceBag.inspect('choice').metadata;
type ChoiceMetadata = Assert<Equal<typeof choiceMetadata, Readonly<{ first: number } | { second: string }>>>;
type Opaque = Exclude<Registration, ((...args: never[]) => unknown) | { create: unknown }>;
type OpaqueOutput = Assert<Equal<ProviderOutput<Opaque>, unknown>>;
type OpaqueNeeds = Assert<Equal<ProviderNeeds<Opaque>, unknown>>;
type WrappedOpaqueNeeds = Assert<Equal<ProviderNeeds<NoInfer<Registration>>, unknown>>;
type WrappedOpaqueOutput = Assert<Equal<ProviderOutput<NoInfer<Registration>>, unknown>>;
type PresenceContract = Assert<Equal<Presence<string>, { readonly present: false } | { readonly present: true; readonly value: string }>>;
type Tuple = Assert<Equal<FramePresenceTuple<readonly [string, number]>, readonly [Presence<string>, Presence<number>]>>;
declare const attempt: AcquisitionSnapshot<readonly [string]>;
if (attempt.metadata[0].present) { const text: string = attempt.metadata[0].value; void text; }
declare const framed: Provider<() => number, Readonly<{ owner: string }>, readonly [{ kind: 'trace'; id: string }]>;
const frameUnit = DiBag.module().add({ framed }).exports(['framed']).rename('framed', 'traced');
const frameView = DiBag.begin().install(frameUnit).end().inspect('traced');
type RetainedFrame = Assert<Equal<typeof frameView.acquisitions, readonly AcquisitionSnapshot<readonly [{ kind: 'trace'; id: string }]>[]>>;
void [exact, team, value, plain];

const mapped = DiBag.mapSync(decorated, value => ({ result: value.read() }));
type MappedOutput = Assert<Equal<ProviderOutput<typeof mapped>, { result: number }>>;
type MappedNeeds = Assert<Equal<ProviderNeeds<typeof mapped>, ProviderNeeds<typeof decorated>>>;
type MappedMetadata = Assert<Equal<ProviderMetadata<typeof mapped>, ProviderMetadata<typeof decorated>>>;
const asyncMapped = DiBag.mapAsync(owned, value => Promise.resolve({ result: value }));
type AsyncMappedOutput = Assert<Equal<ProviderOutput<typeof asyncMapped>, Promise<{ result: number }>>>;
const syncPromise = DiBag.mapSync(owned, value => { const exact: Promise<number> = value; return exact; });
type ExactMappedPromise = Assert<Equal<ProviderOutput<typeof syncPromise>, Promise<number>>>;
const framedMapped = DiBag.withDisposal(DiBag.mapAsync(framed, value => ({ value })), value => {
  const exact: number = value.value; void exact;
});
type MappedFrames = Assert<Equal<ProviderAcquisitionMetadata<typeof framedMapped>, readonly [{ kind: 'trace'; id: string }]>>;
type OwnedMappedMetadata = Assert<Equal<ProviderMetadata<typeof framedMapped>, Readonly<{ owner: string }>>>;
const legacyCreate = ({ clock }: { clock: number }) => ({ read() { return clock; } });
const legacyOwned = DiBag.withDisposal(legacyCreate, value => { const n: number = value.read(); void n; });
type OriginalCreate = Assert<Equal<typeof legacyOwned.create, typeof legacyCreate>>;
const mappedModule = DiBag.module().add({ clock: () => ({ now: () => 42 }), mapped }).exports(['mapped']).rename('mapped', 'result');
const mappedBag = DiBag.begin().install(mappedModule).end();
type InstalledMapping = Assert<Equal<ReturnType<typeof mappedBag.resolve<'result'>>, { result: number }>>;
const mappingReplacement = DiBag.begin().add({ value: () => 1 }).replace('value', DiBag.mapSync(() => 1, value => ({ value }))).end();
type MappingReplacement = Assert<Equal<ReturnType<typeof mappingReplacement.resolve<'value'>>, { value: number }>>;
const mappingFork = bag.fork(['clock'], { clock: DiBag.mapSync(() => 7, value => ({ now() { return value; } })) });
type MappingFork = Assert<Equal<ReturnType<typeof mappingFork.resolve<'clock'>>, { now(): number }>>;
declare const erasedRegistration: NoInfer<Registration>;
const erasedSync = DiBag.mapSync(erasedRegistration, value => { const unknown: unknown = value; return unknown; });
const erasedAsync = DiBag.mapAsync(erasedRegistration, value => value);
const erasedOwned = DiBag.withDisposal(erasedRegistration, value => { const unknown: unknown = value; void unknown; });
type ErasedSyncNeeds = Assert<Equal<ProviderNeeds<typeof erasedSync>, unknown>>;
type ErasedSyncOutput = Assert<Equal<ProviderOutput<typeof erasedSync>, unknown>>;
type ErasedAsyncNeeds = Assert<Equal<ProviderNeeds<typeof erasedAsync>, unknown>>;
type ErasedAsyncOutput = Assert<Equal<ProviderOutput<typeof erasedAsync>, Promise<unknown>>>;
type ErasedOwnedNeeds = Assert<Equal<ProviderNeeds<typeof erasedOwned>, unknown>>;
type ErasedOwnedOutput = Assert<Equal<ProviderOutput<typeof erasedOwned>, unknown>>;
const exactSameObject = DiBag.withDisposal(legacyOwned, value => { const n: number = value.read(); void n; });
type AdditiveOwnedOutput = Assert<Equal<ProviderOutput<typeof exactSameObject>, { read(): number }>>;
const unionMapped = DiBag.mapSync(choiceProvider, value => String(value));
type UnionMappedMetadata = Assert<Equal<ProviderMetadata<typeof unionMapped>, Readonly<{ first: number } | { second: string }>>>;

// Mixed registration kinds must distribute even behind a no-back-inference boundary.
const mixedPlain = ({ plain }: { plain: string }) => plain;
const mixedOwnedFactory = ({ owned }: { owned: boolean }) => owned;
const mixedOwned = DiBag.withDisposal(mixedOwnedFactory, () => {});
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
  Assert<Equal<ProviderNeeds<PlainUnion>, { dep: boolean }>>,
  Assert<Equal<ProviderNeeds<NoInfer<PlainUnion>>, { dep: boolean }>>,
];
type MixedContracts = [
  Assert<Equal<ProviderFactory<Mixed>, MixedFactories>>,
  Assert<Equal<ProviderFactory<NoInfer<Mixed>>, MixedFactories>>,
  Assert<Equal<ProviderOutput<Mixed>, string | boolean | number>>,
  Assert<Equal<ProviderOutput<NoInfer<Mixed>>, string | boolean | number>>,
  Assert<Equal<ProviderNeeds<Mixed>, MixedNeeds>>,
  Assert<Equal<ProviderNeeds<NoInfer<Mixed>>, MixedNeeds>>,
  Assert<Equal<ProviderMetadata<Mixed>, MixedMetadata>>,
  Assert<Equal<ProviderMetadata<NoInfer<Mixed>>, MixedMetadata>>,
  Assert<Equal<ProviderAcquisitionMetadata<Mixed>, MixedFrames>>,
  Assert<Equal<ProviderAcquisitionMetadata<NoInfer<Mixed>>, MixedFrames>>,
  Assert<Equal<ProviderFactory<NoInfer<typeof mixedFramed | typeof mixedOwned | typeof mixedPlain>>, MixedFactories>>,
  Assert<Equal<ProviderFactory<NoInfer<typeof mixedOwned | typeof mixedPlain | typeof mixedFramed>>, MixedFactories>>,
  Assert<Equal<ProviderFactory<NoInfer<typeof mixedPlain | typeof mixedOwned>>, typeof mixedPlain | typeof mixedOwnedFactory>>,
  Assert<Equal<ProviderFactory<NoInfer<typeof mixedPlain | typeof mixedFramed>>, typeof mixedPlain | (({ framed }: { framed: number }) => number)>>,
  Assert<Equal<ProviderFactory<NoInfer<typeof mixedOwned | typeof mixedFramed>>, typeof mixedOwnedFactory | (({ framed }: { framed: number }) => number)>>,
  Assert<Equal<ProviderFactory<NoInfer<() => never>>, () => never>>,
  Assert<Equal<ProviderOutput<NoInfer<() => never>>, never>>,
  Assert<Equal<ProviderNeeds<NoInfer<() => never>>, Record<never, never>>>,
  Assert<Equal<ProviderOutput<NoInfer<Mixed | Opaque>>, unknown>>,
  Assert<Equal<ProviderNeeds<NoInfer<Mixed | Opaque>>, unknown>>,
  Assert<Equal<ProviderMetadata<NoInfer<Mixed | Opaque>>, unknown>>,
  Assert<Equal<ProviderAcquisitionMetadata<NoInfer<Mixed | Opaque>>, readonly unknown[]>>,
];
declare const mixed: Mixed;
const mixedMapped = DiBag.mapSync(mixed, value => {
  type Input = Assert<Equal<typeof value, string | boolean | number>>;
  return { text: String(value) };
});
const mixedAsync = DiBag.mapAsync(mixed, value => {
  type Input = Assert<Equal<typeof value, string | boolean | number>>;
  return Promise.resolve(String(value));
});
const mixedDisposed = DiBag.withDisposal(mixed, value => {
  type Input = Assert<Equal<typeof value, string | boolean | number>>;
});
const mixedAnnotated = DiBag.withMetadata(mixed, { extra: true });
type MixedTransforms = [
  Assert<Equal<ProviderOutput<typeof mixedMapped>, { text: string }>>,
  Assert<Equal<ProviderOutput<typeof mixedAsync>, Promise<string>>>,
  Assert<Equal<ProviderOutput<typeof mixedDisposed>, string | boolean | number>>,
  Assert<Equal<ProviderNeeds<typeof mixedMapped>, MixedNeeds>>,
  Assert<Equal<ProviderNeeds<typeof mixedAsync>, MixedNeeds>>,
  Assert<Equal<ProviderNeeds<typeof mixedDisposed>, MixedNeeds>>,
  Assert<Equal<ProviderMetadata<typeof mixedMapped>, MixedMetadata>>,
  Assert<Equal<ProviderMetadata<typeof mixedAnnotated>, Readonly<MixedMetadata & { extra: boolean }>>>,
  Assert<Equal<ProviderAcquisitionMetadata<typeof mixedMapped>, MixedFrames>>,
  Assert<Equal<ProviderAcquisitionMetadata<typeof mixedDisposed>, MixedFrames>>,
  Assert<Equal<ProviderAcquisitionMetadata<typeof mixedAnnotated>, MixedFrames>>,
];
