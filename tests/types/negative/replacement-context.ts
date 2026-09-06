import { DiBag } from '../../../src';
const consumers = {
  clock: () => ({ now: () => 1, zone: () => 'utc' }),
  first: ({ clock }: { clock: { now(): number } }) => clock.now(),
  second: ({ clock }: { clock: { zone(): string } }) => clock.zone(),
};
const builder = DiBag.begin().add(consumers);
const module = DiBag.module().add(consumers);
// diagnostic: a dependency has the wrong shape
builder.replace('clock', () => ({ now() { return 2; } }));
// diagnostic: a dependency has the wrong shape
builder.replace('clock', () => ({ zone() { return 'new'; } }));
// diagnostic: a dependency has the wrong shape
module.replace('clock', () => ({ now() { return 2; } }));
// diagnostic: a dependency has the wrong shape
module.replace('clock', () => ({ zone() { return 'new'; } }));
const privateModule = DiBag.module().add({ hidden: ({ clock }: { clock: { now(): number } }) => clock.now() }).exports([]);
const host = DiBag.begin().install(privateModule).add({ clock: () => ({ now: () => 1 }) });
// diagnostic: a dependency has the wrong shape
host.replace('clock', () => ({ other() { return true; } }));
const sameLabel = DiBag.module().add({ clock: ({ clock }: { clock: { now(): number } }) => ({ now: () => clock.now() }) }).exports(['clock']);
// diagnostic: a dependency has the wrong shape
DiBag.begin().install(sameLabel).replace('clock', () => ({ other() { return true; } }));
const optional = { value: () => ({ read: () => 1 }), consumer: ({ value }: { value?: { read(): number } }) => value?.read() };
// diagnostic: a dependency has the wrong shape
DiBag.begin().add(optional).replace('value', () => undefined);
// diagnostic: a dependency has the wrong shape
DiBag.module().add(optional).replace('value', () => undefined);
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

const needsBuilder = DiBag.begin().add({ value: () => 0 });
const needsModule = DiBag.module().add({ value: () => 0 });
// diagnostic: missing factories
needsBuilder.replace('value', ({ missing }: { missing: number }) => ({ read() { return missing; } })).end();
// diagnostic: missing factories
needsBuilder.replace('value', (deps?: { missing: number }) => ({ read() { return deps?.missing; } })).end();
// diagnostic: missing factories
needsBuilder.replace('value', ({ missing }: { missing: number } = { missing: 0 }) => ({ read() { return missing; } })).end();
// diagnostic: missing factories
DiBag.begin().install(needsModule.replace('value', ({ missing }: { missing: number }) => ({ read() { return missing; } })).exports(['value'])).end();
// diagnostic: missing factories
DiBag.begin().install(needsModule.replace('value', (deps?: { missing: number }) => ({ read() { return deps?.missing; } })).exports(['value'])).end();
// diagnostic: missing factories
DiBag.begin().install(needsModule.replace('value', ({ missing }: { missing: number } = { missing: 0 }) => ({ read() { return missing; } })).exports(['value'])).end();
