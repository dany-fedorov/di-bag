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
