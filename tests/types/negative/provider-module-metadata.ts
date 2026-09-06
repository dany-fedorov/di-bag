import { DiBag, type Module, type ModuleProvides, type ModuleRequires, type Provider } from '../../../src';
const decorated = DiBag.withMetadata(({ clock }: { clock: { now(): number } }) => ({ read: () => clock.now() }), { owner: 'team' });
const unit = DiBag.module().add({ service: decorated }).exports(['service']);
const renamed = unit.rename('service', 'client');
// diagnostic: missing factories
DiBag.begin().install(renamed).end();
// diagnostic: wrong shape
DiBag.begin().install(renamed).add({ clock: () => ({ now: () => 'wrong' }) });
type C = typeof unit extends Module<infer _P, infer _R, infer Constraints, infer _D> ? Constraints : never;
// diagnostic: not assignable
const erased: Module<ModuleProvides<typeof unit>, ModuleRequires<typeof unit>, C> = unit;
declare const framed: Provider<() => number, {}, readonly [{ tag: string }]>;
const frameModule = DiBag.module().add({ framed }).exports(['framed']);
// diagnostic: not assignable
const erasedFrames: Module<{ framed: number }, {}> = frameModule;
// diagnostic: not assignable
const changedFrames: Provider<() => number, {}, readonly []> = framed;
declare const metadataChoice: { first: number } | { second: string };
const choice = DiBag.module().add({ choice: DiBag.withMetadata(() => 1, metadataChoice) }).exports(['choice']);
// diagnostic: not assignable
const erasedChoice: Module<{ choice: number }, {}> = choice;
type Registration = Parameters<typeof DiBag.withMetadata>[0];
declare const opaqueModule: Module<{ value: unknown }, {}, never, { value: Registration }>;
// diagnostic: factory dependencies must be finite
DiBag.begin().install(opaqueModule).end();
