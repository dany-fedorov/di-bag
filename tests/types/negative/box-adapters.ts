import { DiBag, type ProviderAcquisitionMetadata, type ValBoxFrame, type Provider } from '../../../src';
import { fromSasBox } from '../../../src/sas-box';
import { fromValBox, fromValBoxAsync } from '../../../src/val-box';
const dual = { sync: () => 42, async: async () => 'async' };
const asyncView: { async(): Promise<string> } = dual;
// diagnostic: sync-first requires the complete sync capability field
fromSasBox(() => asyncView, { mode: 'sync-first' });
declare const hiddenOptional: { sync?: never; async(): Promise<string> };
// diagnostic: sync-first requires the complete sync capability field
fromSasBox(() => hiddenOptional, { mode: 'sync-first' });
// diagnostic: invalid sas-box capability
fromSasBox(async () => dual, { mode: 'sync' });
// diagnostic: invalid sas-box capability
fromSasBox(() => ({ async: async () => 1 }), { mode: 'sync' });
declare const mode: 'sync' | 'async';
// diagnostic: invalid sas-box capability
fromSasBox(() => asyncView, { mode });
// diagnostic: invalid sas-box capability
fromSasBox(() => ({ sync: (needed: string) => needed }), { mode: 'sync' });
// diagnostic: invalid sas-box capability
fromSasBox(() => ({ async: (needed: string) => Promise.resolve(needed) }), { mode: 'async' });
// diagnostic: invalid sas-box capability
fromSasBox(() => ({ sync(this: { missing: true }) { return this.missing; } }), { mode: 'sync-first' });
// diagnostic: invalid sas-box capability
fromSasBox(() => ({ async(this: { missing: true }) { return this.missing; } }), { mode: 'async' });
// diagnostic: Expected 2 arguments
fromSasBox(() => dual);
const box = { snapshot: () => ({ value: { present: true as const, value: 42 }, metadata: { present: true as const, value: { owner: 'db' } }, alias: null }) };
// diagnostic: value
fromValBox(() => box, {});
// diagnostic: value
fromValBoxAsync(() => box, {});
// diagnostic: invalid val-box snapshot capability
fromValBox(async () => box);
// diagnostic: invalid val-box snapshot capability
fromValBox(() => ({ snapshot: (_needed: string) => box.snapshot() }));
// diagnostic: invalid val-box snapshot capability
fromValBoxAsync(() => ({ snapshot(this: { missing: true }) { return box.snapshot(); } }));
// diagnostic: invalid val-box snapshot capability
fromValBox(() => ({ snapshot: () => ({ ...box.snapshot(), alias: 42 }) }));
// diagnostic: not assignable
DiBag.withDisposal(fromValBox(() => box), (raw: typeof box) => { void raw; });
const provider = fromValBox(() => box);
declare const frames: ProviderAcquisitionMetadata<typeof provider>;
// diagnostic: not assignable
const erased: readonly [ValBoxFrame<{ owner: number }>] = frames;
// diagnostic: read-only
frames[0].alias = 'mutated';
declare const opaque: Parameters<typeof DiBag.withMetadata>[0];
// diagnostic: invalid sas-box capability
fromSasBox(opaque, { mode: 'async' });
// diagnostic: invalid val-box snapshot capability
fromValBox(opaque);
declare const sasUnion: (() => typeof dual) | (() => { async(): Promise<string> });
// diagnostic: invalid sas-box capability
fromSasBox(sasUnion, { mode: 'sync' });
declare const valUnion: (() => typeof box) | (() => { snapshot(): unknown });
// diagnostic: invalid val-box snapshot capability
fromValBox(valUnion);
// diagnostic: not assignable
const erasedProvider: Provider<() => number> = provider;
// diagnostic: invalid val-box snapshot capability
fromValBox(() => ({ snapshot(this: { missing: true }) { return box.snapshot(); } }), { value: 'presence' });
// diagnostic: invalid val-box snapshot capability
fromValBoxAsync(() => ({ snapshot: (needed: string) => box.snapshot() }), { value: 'presence' });
// diagnostic: not assignable
fromValBox(function (this: { receiver: true }) { return box; });
// diagnostic: not assignable
fromSasBox(function (this: { receiver: true }) { return dual; }, { mode: 'sync' });
// diagnostic: invalid val-box snapshot capability
fromValBoxAsync(opaque);
// diagnostic: invalid val-box snapshot capability
fromValBox(opaque, { value: 'required' });
// diagnostic: invalid val-box snapshot capability
fromValBoxAsync(opaque, { value: 'presence' });
type InvalidFactory = () => { snapshot(): unknown };
declare const invalidFactory: InvalidFactory;
// diagnostic: invalid val-box snapshot capability
fromValBox<InvalidFactory>(invalidFactory);
// diagnostic: invalid val-box snapshot capability
fromValBoxAsync<InvalidFactory>(invalidFactory);
// diagnostic: invalid val-box snapshot capability
fromValBox<InvalidFactory, 'presence'>(invalidFactory, { value: 'presence' });
// diagnostic: invalid val-box snapshot capability
fromValBoxAsync<InvalidFactory, 'required'>(invalidFactory, { value: 'required' });
