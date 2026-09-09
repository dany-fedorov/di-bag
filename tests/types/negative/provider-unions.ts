import { DiBag } from '../../../src';
import { fromSasBox } from '../../../src/sas-box';
import { fromValBox, fromValBoxAsync } from '../../../src/val-box';

const good = (_deps: { dep: boolean }) => ({
  snapshot: () => ({ value: { present: true as const, value: 42 }, metadata: { present: false as const }, alias: null }),
});
const provider = DiBag.withMetadata(good, { owner: 'source' });
const owned = DiBag.withDisposal(good, () => {});
const bad = () => ({ snapshot: (): unknown => 42 });
declare const mixed: typeof provider | typeof owned | typeof bad;
declare const reversed: typeof bad | typeof owned | typeof provider;
declare const rotated: typeof owned | typeof provider | typeof bad;
declare const providerPlain: typeof provider | typeof bad;
declare const ownedPlain: typeof owned | typeof bad;
const badProvider = DiBag.withMetadata(bad, { bad: true });
declare const providerOwned: typeof badProvider | typeof owned;
// diagnostic: not assignable
DiBag.mapSync(mixed, (value: number) => value.toFixed());
// diagnostic: not assignable
DiBag.mapAsync(mixed, (value: number) => value.toFixed());
// diagnostic: No overload matches
DiBag.withDisposal(mixed, (value: number) => { value.toFixed(); });
// diagnostic: invalid sas-box capability
fromSasBox(mixed, { mode: 'sync' });
// diagnostic: invalid val-box snapshot capability
fromValBox(mixed);
// diagnostic: invalid val-box snapshot capability
fromValBox(mixed, { value: 'presence' });
// diagnostic: invalid val-box snapshot capability
fromValBoxAsync(mixed);
// diagnostic: invalid val-box snapshot capability
fromValBoxAsync(mixed, { value: 'presence' });
// diagnostic: invalid val-box snapshot capability
fromValBox(reversed);
// diagnostic: invalid val-box snapshot capability
fromValBox(rotated);
// diagnostic: invalid val-box snapshot capability
fromValBox(providerPlain);
// diagnostic: invalid val-box snapshot capability
fromValBox(ownedPlain);
// diagnostic: invalid val-box snapshot capability
fromValBox(providerOwned);
// diagnostic: duplicate metadata
DiBag.withMetadata(mixed, { owner: 'duplicate' });
// diagnostic: duplicate metadata
DiBag.withMetadata(reversed, { owner: 'duplicate' });
// diagnostic: missing factories
DiBag.begin().add({ mapped: DiBag.mapSync(mixed, value => value.snapshot()) }).end();

type Registration = Parameters<typeof DiBag.withMetadata>[0];
type Opaque = Exclude<Registration, ((...args: never[]) => unknown) | { create: unknown }>;
declare const opaqueMixed: NoInfer<Opaque | typeof owned | typeof bad>;
// diagnostic: not assignable
DiBag.mapSync(opaqueMixed, (value: number) => value.toFixed());
// diagnostic: No overload matches
DiBag.withDisposal(opaqueMixed, (value: number) => {});
// diagnostic: invalid sas-box capability
fromSasBox(opaqueMixed, { mode: 'sync' });
// diagnostic: invalid val-box snapshot capability
fromValBoxAsync(opaqueMixed);
// diagnostic: factory dependencies must be finite
// diagnostic-also: TS2684 missing factories
DiBag.begin().add({ mapped: DiBag.mapSync(opaqueMixed, () => 42) }).end();
