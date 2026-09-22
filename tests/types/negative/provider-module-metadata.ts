import { DiBag, type Module, type ModuleExportedServices, type ModuleRequiredServices, type Provider } from '../../../src';
const decorated = DiBag.withMetadata(({ clock }: { clock: { now(): number } }) => ({ read: () => clock.now() }), { static: { owner: 'team' } });
const unit = DiBag.createBuilder().withServices({ service: decorated }).buildModule({ exportedServiceKeys: ['service'] });
const renamed = unit.withRenamedExport({ currentExportKey: 'service', newExportKey: 'client' });
// diagnostic: required service registrations are missing
DiBag.createBuilder().withInstalledModules([renamed]).buildContainer();
// diagnostic: consumer dependency
DiBag.createBuilder().withInstalledModules([renamed]).withServices({ clock: () => ({ now: () => 'wrong' }) });
type C = typeof unit extends Module<infer _P, infer _R, infer Constraints, infer _D> ? Constraints : never;
// diagnostic: not assignable
const erased: Module<ModuleExportedServices<typeof unit>, ModuleRequiredServices<typeof unit>, C> = unit;
declare const framed: Provider<() => number, {}, readonly [{ tag: string }]>;
const frameModule = DiBag.createBuilder().withServices({ framed }).buildModule({ exportedServiceKeys: ['framed'] });
// diagnostic: not assignable
const erasedFrames: Module<{ framed: number }, {}> = frameModule;
// diagnostic: not assignable
const changedFrames: Provider<() => number, {}, readonly []> = framed;
declare const metadataChoice: { first: number } | { second: string };
const choice = DiBag.createBuilder().withServices({ choice: DiBag.withMetadata(() => 1, { static: metadataChoice }) }).buildModule({ exportedServiceKeys: ['choice'] });
// diagnostic: not assignable
const erasedChoice: Module<{ choice: number }, {}> = choice;
type Registration = Parameters<typeof DiBag.withMetadata>[0];
declare const opaqueModule: Module<{ value: unknown }, {}, never, { value: Registration }>;
// diagnostic: factory dependencies must be finite
// diagnostic-also: TS2684 required service registrations are missing
DiBag.createBuilder().withInstalledModules([opaqueModule]).buildContainer();
