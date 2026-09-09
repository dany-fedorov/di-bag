import { DiBag } from '../../../src';

const good = (_deps: { dep: boolean }) => ({
  read: () => 42,
});
const provider = DiBag.withMetadata(good, { owner: 'source' });
const owned = DiBag.withDisposal(good, () => {});
const bad = () => ({ read: (): unknown => 42 });
declare const mixed: typeof provider | typeof owned | typeof bad;
declare const reversed: typeof bad | typeof owned | typeof provider;
// diagnostic: not assignable
DiBag.mapSync(mixed, (value: number) => value.toFixed());
// diagnostic: not assignable
DiBag.mapAsync(mixed, (value: number) => value.toFixed());
// diagnostic: No overload matches
DiBag.withDisposal(mixed, (value: number) => { value.toFixed(); });
// diagnostic: duplicate metadata
DiBag.withMetadata(mixed, { owner: 'duplicate' });
// diagnostic: duplicate metadata
DiBag.withMetadata(reversed, { owner: 'duplicate' });
// diagnostic: missing factories
DiBag.begin().add({ mapped: DiBag.mapSync(mixed, value => value.read()) }).end();

type Registration = Parameters<typeof DiBag.withMetadata>[0];
type Opaque = Exclude<Registration, ((...args: never[]) => unknown) | { create: unknown }>;
declare const opaqueMixed: NoInfer<Opaque | typeof owned | typeof bad>;
// diagnostic: not assignable
DiBag.mapSync(opaqueMixed, (value: number) => value.toFixed());
// diagnostic: No overload matches
DiBag.withDisposal(opaqueMixed, (value: number) => {});
// diagnostic: factory dependencies must be finite
// diagnostic-also: TS2684 missing factories
DiBag.begin().add({ mapped: DiBag.mapSync(opaqueMixed, () => 42) }).end();
