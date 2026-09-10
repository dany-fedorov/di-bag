import { DiBag } from '../../../src';
const consumers = {
  clock: () => ({ now: () => 1, zone: () => 'utc' }),
  first: ({ clock }: { clock: { now(): number } }) => clock.now(),
  second: ({ clock }: { clock: { zone(): string } }) => clock.zone(),
};
const builder = DiBag.createBuilder().register(consumers);
const module = DiBag.createBuilder().register(consumers);
// diagnostic: provided service does not satisfy its consumer dependency
builder.replace('clock', () => ({ now() { return 2; } }));
// diagnostic: provided service does not satisfy its consumer dependency
builder.replace('clock', () => ({ zone() { return 'new'; } }));
// diagnostic: provided service does not satisfy its consumer dependency
module.replace('clock', () => ({ now() { return 2; } }));
// diagnostic: provided service does not satisfy its consumer dependency
module.replace('clock', () => ({ zone() { return 'new'; } }));
const privateModule = DiBag.createBuilder().register({ hidden: ({ clock }: { clock: { now(): number } }) => clock.now() }).buildModule([]);
const host = DiBag.createBuilder().installModule(privateModule).register({ clock: () => ({ now: () => 1 }) });
// diagnostic: provided service does not satisfy its consumer dependency
host.replace('clock', () => ({ other() { return true; } }));
const sameLabel = DiBag.createBuilder().register({ clock: ({ clock }: { clock: { now(): number } }) => ({ now: () => clock.now() }) }).buildModule(['clock']);
// diagnostic: provided service does not satisfy its consumer dependency
DiBag.createBuilder().installModule(sameLabel).replace('clock', () => ({ other() { return true; } }));
const optional = { value: () => ({ read: () => 1 }), consumer: ({ value }: { value?: { read(): number } }) => value?.read() };
// diagnostic: provided service does not satisfy its consumer dependency
DiBag.createBuilder().register(optional).replace('value', () => undefined);
// diagnostic: provided service does not satisfy its consumer dependency
DiBag.createBuilder().register(optional).replace('value', () => undefined);
type Registration = Parameters<typeof DiBag.withMetadata>[0];
type Opaque = Exclude<Registration, ((...args: never[]) => unknown) | { create: unknown }>;
declare const opaque: Opaque;
declare const broad: (this: void, deps: never) => unknown;
const broadOwned = DiBag.withDisposal(broad, () => {});
// diagnostic: factory dependencies must be finite
builder.replace('clock', opaque);
// diagnostic: factory dependencies must be finite
module.replace('clock', opaque);
// diagnostic: factory dependencies must be finite
builder.replace('clock', broad);
// diagnostic: factory dependencies must be finite
module.replace('clock', broadOwned);
// diagnostic: does not satisfy the constraint
builder.replace<'clock', unknown>('clock', () => ({ now: () => 1, zone: () => 'utc' }));
// diagnostic: does not satisfy the constraint
module.replace<'clock', unknown>('clock', () => ({ now: () => 1, zone: () => 'utc' }));

const needsBuilder = DiBag.createBuilder().register({ value: () => 0 });
const needsModule = DiBag.createBuilder().register({ value: () => 0 });
// diagnostic: required service registrations are missing
needsBuilder.replace('value', ({ missing }: { missing: number }) => ({ read() { return missing; } })).build();
// diagnostic: required service registrations are missing
needsBuilder.replace('value', (deps?: { missing: number }) => ({ read() { return deps?.missing; } })).build();
// diagnostic: required service registrations are missing
needsBuilder.replace('value', ({ missing }: { missing: number } = { missing: 0 }) => ({ read() { return missing; } })).build();
// diagnostic: required service registrations are missing
DiBag.createBuilder().installModule(needsModule.replace('value', ({ missing }: { missing: number }) => ({ read() { return missing; } })).buildModule(['value'])).build();
// diagnostic: required service registrations are missing
DiBag.createBuilder().installModule(needsModule.replace('value', (deps?: { missing: number }) => ({ read() { return deps?.missing; } })).buildModule(['value'])).build();
// diagnostic: required service registrations are missing
DiBag.createBuilder().installModule(needsModule.replace('value', ({ missing }: { missing: number } = { missing: 0 }) => ({ read() { return missing; } })).buildModule(['value'])).build();

const wrongOptionalBuilder = DiBag.createBuilder().register({ dep: () => 1, service: () => 0 });
const wrongOptionalModule = DiBag.createBuilder().register({ dep: () => 1, service: () => 0 });
type WrongOptionalFactory = (deps?: { dep: string }) => number;
// diagnostic: provided service does not satisfy its consumer dependency
wrongOptionalBuilder.replace('service', (deps?: { dep: string }) => deps?.dep.length ?? 0);
// diagnostic: provided service does not satisfy its consumer dependency
wrongOptionalBuilder.replace('service', ({ dep }: { dep: string } = { dep: '' }) => dep.length);
// diagnostic: provided service does not satisfy its consumer dependency
wrongOptionalBuilder.replace<'service', WrongOptionalFactory>('service', (deps?: { dep: string }) => deps?.dep.length ?? 0);
// diagnostic: provided service does not satisfy its consumer dependency
wrongOptionalBuilder.replace<'service', WrongOptionalFactory>('service', ({ dep }: { dep: string } = { dep: '' }) => dep.length);
// diagnostic: provided service does not satisfy its consumer dependency
wrongOptionalModule.replace('service', (deps?: { dep: string }) => deps?.dep.length ?? 0);
// diagnostic: provided service does not satisfy its consumer dependency
wrongOptionalModule.replace('service', ({ dep }: { dep: string } = { dep: '' }) => dep.length);
// diagnostic: provided service does not satisfy its consumer dependency
wrongOptionalModule.replace<'service', WrongOptionalFactory>('service', (deps?: { dep: string }) => deps?.dep.length ?? 0);
// diagnostic: provided service does not satisfy its consumer dependency
wrongOptionalModule.replace<'service', WrongOptionalFactory>('service', ({ dep }: { dep: string } = { dep: '' }) => dep.length);
