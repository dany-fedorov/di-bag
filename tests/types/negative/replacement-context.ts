import { DiBag } from '../../../src';
const consumers = {
  clock: () => ({ now: () => 1, zone: () => 'utc' }),
  first: ({ clock }: { clock: { now(): number } }) => clock.now(),
  second: ({ clock }: { clock: { zone(): string } }) => clock.zone(),
};
const builder = DiBag.createBuilder().withServices(consumers);
const module = DiBag.createBuilder().withServices(consumers);
// diagnostic: provided service does not satisfy its consumer dependency
builder.withReplacedService('clock', () => ({ now() { return 2; } }));
// diagnostic: provided service does not satisfy its consumer dependency
builder.withReplacedService('clock', () => ({ zone() { return 'new'; } }));
// diagnostic: provided service does not satisfy its consumer dependency
module.withReplacedService('clock', () => ({ now() { return 2; } }));
// diagnostic: provided service does not satisfy its consumer dependency
module.withReplacedService('clock', () => ({ zone() { return 'new'; } }));
const privateModule = DiBag.createBuilder().withServices({ hidden: ({ clock }: { clock: { now(): number } }) => clock.now() }).buildModule({ exportedServiceKeys: [] });
const host = DiBag.createBuilder().withInstalledModules([privateModule]).withServices({ clock: () => ({ now: () => 1 }) });
// diagnostic: provided service does not satisfy its consumer dependency
host.withReplacedService('clock', () => ({ other() { return true; } }));
const sameLabel = DiBag.createBuilder().withServices({ clock: ({ clock }: { clock: { now(): number } }) => ({ now: () => clock.now() }) }).buildModule({ exportedServiceKeys: ['clock'] });
// diagnostic: provided service does not satisfy its consumer dependency
DiBag.createBuilder().withInstalledModules([sameLabel]).withReplacedService('clock', () => ({ other() { return true; } }));
const optional = { value: () => ({ read: () => 1 }), consumer: ({ value }: { value?: { read(): number } }) => value?.read() };
// diagnostic: provided service does not satisfy its consumer dependency
DiBag.createBuilder().withServices(optional).withReplacedService('value', () => undefined);
// diagnostic: provided service does not satisfy its consumer dependency
DiBag.createBuilder().withServices(optional).withReplacedService('value', () => undefined);
type Registration = Parameters<typeof DiBag.withMetadata>[0];
type Opaque = Exclude<Registration, ((...args: never[]) => unknown) | { create: unknown }>;
declare const opaque: Opaque;
declare const broad: (this: void, deps: never) => unknown;
const broadOwned = DiBag.withDisposal(broad, () => {});
// diagnostic: factory dependencies must be finite
builder.withReplacedService('clock', opaque);
// diagnostic: factory dependencies must be finite
module.withReplacedService('clock', opaque);
// diagnostic: factory dependencies must be finite
builder.withReplacedService('clock', broad);
// diagnostic: factory dependencies must be finite
module.withReplacedService('clock', broadOwned);
// diagnostic: does not satisfy the constraint
builder.withReplacedService<'clock', unknown>('clock', () => ({ now: () => 1, zone: () => 'utc' }));
// diagnostic: does not satisfy the constraint
module.withReplacedService<'clock', unknown>('clock', () => ({ now: () => 1, zone: () => 'utc' }));

const needsBuilder = DiBag.createBuilder().withServices({ value: () => 0 });
const needsModule = DiBag.createBuilder().withServices({ value: () => 0 });
// diagnostic: required service registrations are missing
needsBuilder.withReplacedService('value', ({ missing }: { missing: number }) => ({ read() { return missing; } })).buildContainer();
// diagnostic: required service registrations are missing
needsBuilder.withReplacedService('value', (deps?: { missing: number }) => ({ read() { return deps?.missing; } })).buildContainer();
// diagnostic: required service registrations are missing
needsBuilder.withReplacedService('value', ({ missing }: { missing: number } = { missing: 0 }) => ({ read() { return missing; } })).buildContainer();
// diagnostic: required service registrations are missing
DiBag.createBuilder().withInstalledModules([needsModule.withReplacedService('value', ({ missing }: { missing: number }) => ({ read() { return missing; } })).buildModule({ exportedServiceKeys: ['value'] })]).buildContainer();
// diagnostic: required service registrations are missing
DiBag.createBuilder().withInstalledModules([needsModule.withReplacedService('value', (deps?: { missing: number }) => ({ read() { return deps?.missing; } })).buildModule({ exportedServiceKeys: ['value'] })]).buildContainer();
// diagnostic: required service registrations are missing
DiBag.createBuilder().withInstalledModules([needsModule.withReplacedService('value', ({ missing }: { missing: number } = { missing: 0 }) => ({ read() { return missing; } })).buildModule({ exportedServiceKeys: ['value'] })]).buildContainer();

const wrongOptionalBuilder = DiBag.createBuilder().withServices({ dep: () => 1, service: () => 0 });
const wrongOptionalModule = DiBag.createBuilder().withServices({ dep: () => 1, service: () => 0 });
type WrongOptionalFactory = (deps?: { dep: string }) => number;
// diagnostic: provided service does not satisfy its consumer dependency
wrongOptionalBuilder.withReplacedService('service', (deps?: { dep: string }) => deps?.dep.length ?? 0);
// diagnostic: provided service does not satisfy its consumer dependency
wrongOptionalBuilder.withReplacedService('service', ({ dep }: { dep: string } = { dep: '' }) => dep.length);
// diagnostic: provided service does not satisfy its consumer dependency
wrongOptionalBuilder.withReplacedService<'service', WrongOptionalFactory>('service', (deps?: { dep: string }) => deps?.dep.length ?? 0);
// diagnostic: provided service does not satisfy its consumer dependency
wrongOptionalBuilder.withReplacedService<'service', WrongOptionalFactory>('service', ({ dep }: { dep: string } = { dep: '' }) => dep.length);
// diagnostic: provided service does not satisfy its consumer dependency
wrongOptionalModule.withReplacedService('service', (deps?: { dep: string }) => deps?.dep.length ?? 0);
// diagnostic: provided service does not satisfy its consumer dependency
wrongOptionalModule.withReplacedService('service', ({ dep }: { dep: string } = { dep: '' }) => dep.length);
// diagnostic: provided service does not satisfy its consumer dependency
wrongOptionalModule.withReplacedService<'service', WrongOptionalFactory>('service', (deps?: { dep: string }) => deps?.dep.length ?? 0);
// diagnostic: provided service does not satisfy its consumer dependency
wrongOptionalModule.withReplacedService<'service', WrongOptionalFactory>('service', ({ dep }: { dep: string } = { dep: '' }) => dep.length);
