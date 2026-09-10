import { DiBag } from '../../../src';
// diagnostic: not assignable
DiBag.withMetadata(() => 1, { dynamic: { mode: 'direct', describe: () => 2 } });
// diagnostic: not assignable
DiBag.withMetadata(() => 1, { dynamic: { mode: 'direct', describe: () => null } });
// diagnostic: acquisition metadata must be a synchronous object record
// diagnostic-also: TS2769 Type '"direct"' is not assignable to type '"awaited"'.
DiBag.withMetadata(() => 1, { dynamic: { mode: 'direct', describe: async () => ({ origin: 'async' }) } });
// diagnostic: acquisition metadata must be a synchronous object record
DiBag.withMetadata(() => 1, { dynamic: { mode: 'awaited', describe: async () => ({ origin: 'async' }) } });
// diagnostic: acquisition metadata must be a synchronous object record
// diagnostic-also: TS2769 Type '"direct"' is not assignable to type '"awaited"'.
DiBag.withMetadata(() => 1, { dynamic: { mode: 'direct', describe: () => [] } });
// diagnostic: acquisition metadata must be a synchronous object record
// diagnostic-also: TS2769 Type '"direct"' is not assignable to type '"awaited"'.
DiBag.withMetadata(() => 1, { dynamic: { mode: 'direct', describe: () => () => 1 } });
// diagnostic: acquisition metadata must be a synchronous object record
// diagnostic-also: TS2769 Type '"direct"' is not assignable to type '"awaited"'.
DiBag.withMetadata(() => 1, { dynamic: { mode: 'direct', describe: () => ({ then() {} }) } });
declare const unionMetadata: { origin: string } | Promise<{ origin: string }>;
// diagnostic: acquisition metadata must be a synchronous object record
// diagnostic-also: TS2769 Type '"direct"' is not assignable to type '"awaited"'.
DiBag.withMetadata(() => 1, { dynamic: { mode: 'direct', describe: () => unionMetadata } });
// diagnostic: not assignable
DiBag.withMetadata(() => Promise.resolve(1), { dynamic: { mode: 'direct', describe: (value: number) => ({ value }) } });
// diagnostic: not assignable
DiBag.withMetadata(() => Promise.resolve(1), { dynamic: { mode: 'awaited', describe: (value: Promise<number>) => ({ value }) } });
// diagnostic: not assignable
DiBag.withMetadata(() => 1, { dynamic: { mode: 'direct', describe: function (this: { origin: string }, value) { return { origin: this.origin, value }; } } });
type OpaqueRegistration = Exclude<Parameters<typeof DiBag.withMetadata>[0], ((...args: never[]) => unknown) | { create: unknown }>;
declare const opaque: OpaqueRegistration;
// diagnostic: not assignable
DiBag.withMetadata(opaque, { dynamic: { mode: 'direct', describe: (value: number) => ({ value }) } });
// diagnostic: factory dependencies must be finite
// diagnostic-also: TS2684 required service registrations are missing
DiBag.createBuilder().register({ value: DiBag.withMetadata(opaque, { dynamic: { mode: 'direct', describe: value => ({ value }) } }) }).build();
const annotated = DiBag.withMetadata(({ dep }: { dep: number }) => dep, { dynamic: { mode: 'direct', describe: value => ({ value }) } });
// diagnostic: required service registrations are missing
DiBag.createBuilder().register({ annotated }).build();
// diagnostic: consumer dependency
DiBag.createBuilder().register({ annotated, dep: () => 'wrong' });
// diagnostic: read-only
DiBag.createBuilder().register({ value: DiBag.withMetadata(() => 1, { dynamic: { mode: 'direct', describe: value => ({ value }) } }) }).build().inspect('value').acquisitions[0]!.acquisitionMetadata[0] = { present: false };
