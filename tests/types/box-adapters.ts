import { DiBag, type Presence, type ProviderOutput, type ProviderNeeds, type ProviderAcquisitionMetadata, type ValBoxFrame } from '../../src';
import { fromSasBox } from '../../src/sas-box';
import { fromValBox, fromValBoxAsync } from '../../src/val-box';
import type { Assert, Equal } from './assert';

const dual = { sync: () => 42, async: async () => 'async' };
const sync = fromSasBox(() => dual, { mode: 'sync' });
const async = fromSasBox(() => dual, { mode: 'async' });
const first = fromSasBox(() => dual, { mode: 'sync-first' });
const fallback = fromSasBox(() => ({ sync: undefined, async: async () => 'async' }), { mode: 'sync-first' });
const promise = fromSasBox(() => ({ sync: () => Promise.resolve(4) }), { mode: 'sync' });
declare const mode: 'sync' | 'async' | 'sync-first';
const union = fromSasBox(() => dual, { mode });
declare const maybe: { sync: (() => number) | undefined; async(): Promise<string> };
const possible = fromSasBox(() => maybe, { mode: 'sync-first' });
declare const sasSource: (() => typeof dual) | (() => { sync(): boolean; async(): Promise<boolean> });
const sasSourceUnion = fromSasBox(sasSource, { mode: 'sync-first' });
type SourceUnion = Assert<Equal<ProviderOutput<typeof sasSourceUnion>, Promise<number | boolean>>>;
const asyncView: { async(): Promise<string> } = dual;
fromSasBox(() => asyncView, { mode: 'async' });
const receiver = { value: 1, sync(this: { value: number }) { return this.value; } };
fromSasBox(() => receiver, { mode: 'sync' });
type Outputs = [Assert<Equal<ProviderOutput<typeof sync>, number>>, Assert<Equal<ProviderOutput<typeof async>, Promise<string>>>,
  Assert<Equal<ProviderOutput<typeof first>, Promise<number>>>, Assert<Equal<ProviderOutput<typeof fallback>, Promise<string>>>,
  Assert<Equal<ProviderOutput<typeof promise>, Promise<number>>>, Assert<Equal<ProviderOutput<typeof union>, number | Promise<string> | Promise<number>>>,
  Assert<Equal<ProviderOutput<typeof possible>, Promise<string | number>>>];

const raw = { snapshot(this: { snapshot: unknown }) { return { value: { present: true as const, value: Promise.resolve(42) }, metadata: { present: true as const, value: { owner: 'db' } }, alias: null }; } };
const val = fromValBox(DiBag.withMetadata(({ dep }: { dep: boolean }) => { void dep; return raw; }, { source: 'test' }));
const valAsync = fromValBoxAsync(async () => raw);
declare const value: 'required' | 'presence';
const valUnion = fromValBox(() => raw, { value });
declare const valSource: (() => typeof raw) | (() => { snapshot(): { value: Presence<string>; metadata: Presence<boolean>; alias: string | null } });
const valSourceUnion = fromValBoxAsync(valSource, { value });
type ValSourceUnion = Assert<Equal<ProviderOutput<typeof valSourceUnion>, Promise<number | string | Presence<Promise<number> | string>>>>;
type Values = [Assert<Equal<ProviderOutput<typeof val>, Promise<number>>>, Assert<Equal<ProviderNeeds<typeof val>, { dep: boolean }>>,
  Assert<Equal<ProviderOutput<typeof valAsync>, Promise<number>>>, Assert<Equal<ProviderOutput<typeof valUnion>, Promise<number> | Presence<Promise<number>>>>,
  Assert<Equal<ProviderAcquisitionMetadata<typeof val>, readonly [ValBoxFrame<{ owner: string }>]>>];
// Predeclare context-sensitive nested method factories; no type annotation or cast.
const nestedFactory = () => ({ snapshot() { return { value: { present: true as const, value: raw }, metadata: { present: false as const }, alias: '' }; } });
const nested = fromValBox(nestedFactory);
const final = DiBag.withDisposal(DiBag.mapAsync(fromValBox(nested), value => String(value)), value => { const string: string = value; void string; });
type Frames = Assert<Equal<ProviderAcquisitionMetadata<typeof final>, readonly [ValBoxFrame<never>, ValBoxFrame<{ owner: string }>]>>;
const feature = DiBag.module().add({ final }).exports(['final']);
const bag = DiBag.begin().install(feature).end();
const frames = bag.inspect('final').acquisitions[0]!.metadata;
type Inspected = Assert<Equal<typeof frames, readonly [Presence<ValBoxFrame<never>>, Presence<ValBoxFrame<{ owner: string }>>]>>;
void bag.close();

// All registration kinds retain their exact capabilities and adapter frames.
const mixedFactory = ({ dep }: { dep: boolean }) => ({
  sync: () => dep ? 42 : 0,
  async: async () => dep ? 'yes' : 'no',
  snapshot: () => ({ value: { present: true as const, value: Promise.resolve(42) }, metadata: { present: true as const, value: { branch: 'plain' } }, alias: null }),
});
const mixedOwned = DiBag.withDisposal(mixedFactory, () => {});
const mixedProvider = DiBag.withMetadata(mixedFactory, { owner: 'source' });
declare const mixed: typeof mixedFactory | typeof mixedOwned | typeof mixedProvider;
const mixedSync = fromSasBox(mixed, { mode: 'sync' });
const mixedFirst = fromSasBox(mixed, { mode: 'sync-first' });
const mixedAsync = fromSasBox(mixed, { mode: 'async' });
const mixedVal = fromValBox(mixed);
const mixedPresence = fromValBox(mixed, { value: 'presence' });
const mixedValAsync = fromValBoxAsync(mixed);
const mixedPresenceAsync = fromValBoxAsync(mixed, { value: 'presence' });
type MixedContracts = [
  Assert<Equal<ProviderOutput<typeof mixedSync>, 0 | 42>>,
  Assert<Equal<ProviderOutput<typeof mixedFirst>, Promise<0 | 42>>>,
  Assert<Equal<ProviderOutput<typeof mixedAsync>, Promise<'yes' | 'no'>>>,
  Assert<Equal<ProviderOutput<typeof mixedVal>, Promise<number>>>,
  Assert<Equal<ProviderOutput<typeof mixedPresence>, Presence<Promise<number>>>>,
  Assert<Equal<ProviderOutput<typeof mixedValAsync>, Promise<number>>>,
  Assert<Equal<ProviderOutput<typeof mixedPresenceAsync>, Promise<Presence<Promise<number>>>>>,
  Assert<Equal<ProviderNeeds<typeof mixedSync>, { dep: boolean }>>,
  Assert<Equal<ProviderNeeds<typeof mixedFirst>, { dep: boolean }>>,
  Assert<Equal<ProviderNeeds<typeof mixedAsync>, { dep: boolean }>>,
  Assert<Equal<ProviderNeeds<typeof mixedVal>, { dep: boolean }>>,
  Assert<Equal<ProviderNeeds<typeof mixedPresence>, { dep: boolean }>>,
  Assert<Equal<ProviderNeeds<typeof mixedValAsync>, { dep: boolean }>>,
  Assert<Equal<ProviderNeeds<typeof mixedPresenceAsync>, { dep: boolean }>>,
  Assert<Equal<ProviderAcquisitionMetadata<typeof mixedVal>, readonly [ValBoxFrame<{ branch: string }>]>>,
];
const mixedNestedFactory = ({ dep }: { dep: boolean }) => ({
  snapshot: () => ({ value: { present: true as const, value: mixedFactory({ dep }) }, metadata: { present: true as const, value: { outer: true } }, alias: 'outer' }),
});
const mixedFramed = fromValBox(mixedNestedFactory);
declare const mixedFrames: typeof mixedFactory | typeof mixedOwned | typeof mixedFramed;
const mixedUnboxed = fromValBox(mixedFrames);
const mixedRemapped = DiBag.withDisposal(DiBag.mapSync(mixedUnboxed, value => value), () => {});
type OrderedMixedFrames = Assert<Equal<ProviderAcquisitionMetadata<typeof mixedRemapped>,
  readonly [ValBoxFrame<{ branch: string }>] | readonly [ValBoxFrame<{ outer: boolean }>, ValBoxFrame<{ branch: string }>]>>;
