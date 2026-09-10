import { DiBag } from '../../../src';

const good = (_deps: { dep: boolean }) => ({
  read: () => 42,
});
const provider = DiBag.withMetadata(good, { static: { owner: 'source' } });
const owned = DiBag.withDisposal(good, () => {});
const bad = () => ({ read: (): unknown => 42 });
declare const mixed: typeof provider | typeof owned | typeof bad;
declare const reversed: typeof bad | typeof owned | typeof provider;
// diagnostic: not assignable
DiBag.transformService(mixed, { mode: 'direct', transform: (value: number) => value.toFixed() });
// diagnostic: not assignable
DiBag.transformService(mixed, { mode: 'awaited', transform: (value: number) => value.toFixed() });
// diagnostic: No overload matches
DiBag.withDisposal(mixed, (value: number) => { value.toFixed(); });
// diagnostic: duplicate metadata
DiBag.withMetadata(mixed, { static: { owner: 'duplicate' } });
// diagnostic: duplicate metadata
DiBag.withMetadata(reversed, { static: { owner: 'duplicate' } });
// diagnostic: required service registrations are missing
DiBag.createBuilder().register({ mapped: DiBag.transformService(mixed, { mode: 'direct', transform: value => value.read() }) }).build();

type Registration = Parameters<typeof DiBag.withMetadata>[0];
type Opaque = Exclude<Registration, ((...args: never[]) => unknown) | { create: unknown }>;
declare const opaqueMixed: NoInfer<Opaque | typeof owned | typeof bad>;
// diagnostic: not assignable
DiBag.transformService(opaqueMixed, { mode: 'direct', transform: (value: number) => value.toFixed() });
// diagnostic: No overload matches
DiBag.withDisposal(opaqueMixed, (value: number) => {});
// diagnostic: factory dependencies must be finite
// diagnostic-also: TS2684 required service registrations are missing
DiBag.createBuilder().register({ mapped: DiBag.transformService(opaqueMixed, { mode: 'direct', transform: () => 42 }) }).build();
