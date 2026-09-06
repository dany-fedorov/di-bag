import { DiBag, type Module, type Provider, type ProviderOutput, type ProviderNeeds, type ProviderMetadata, type ProviderAcquisitionMetadata, type Presence, type FramePresenceTuple, type AcquisitionSnapshot } from '../../src';
import type { Assert, Equal } from './assert';
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
