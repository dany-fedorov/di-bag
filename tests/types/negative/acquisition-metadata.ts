import { DiBag } from '../../../src';
// diagnostic: not assignable
DiBag.withAcquisitionMetadata(() => 1, () => 2);
// diagnostic: not assignable
DiBag.withAcquisitionMetadata(() => 1, () => null);
// diagnostic: acquisition metadata must be a synchronous object record
DiBag.withAcquisitionMetadata(() => 1, async () => ({ origin: 'async' }));
// diagnostic: acquisition metadata must be a synchronous object record
DiBag.withAcquisitionMetadataAsync(() => 1, async () => ({ origin: 'async' }));
// diagnostic: acquisition metadata must be a synchronous object record
DiBag.withAcquisitionMetadata(() => 1, () => []);
// diagnostic: acquisition metadata must be a synchronous object record
DiBag.withAcquisitionMetadata(() => 1, () => () => 1);
// diagnostic: acquisition metadata must be a synchronous object record
DiBag.withAcquisitionMetadata(() => 1, () => ({ then() {} }));
declare const unionMetadata: { origin: string } | Promise<{ origin: string }>;
// diagnostic: acquisition metadata must be a synchronous object record
DiBag.withAcquisitionMetadata(() => 1, () => unionMetadata);
// diagnostic: not assignable
DiBag.withAcquisitionMetadata(() => Promise.resolve(1), (value: number) => ({ value }));
// diagnostic: not assignable
DiBag.withAcquisitionMetadataAsync(() => Promise.resolve(1), (value: Promise<number>) => ({ value }));
// diagnostic: not assignable
DiBag.withAcquisitionMetadata(() => 1, function (this: { origin: string }, value) { return { origin: this.origin, value }; });
type OpaqueRegistration = Exclude<Parameters<typeof DiBag.withMetadata>[0], ((...args: never[]) => unknown) | { create: unknown }>;
declare const opaque: OpaqueRegistration;
// diagnostic: not assignable
DiBag.withAcquisitionMetadata(opaque, (value: number) => ({ value }));
// diagnostic: factory dependencies must be finite
// diagnostic-also: TS2684 missing factories
DiBag.begin().add({ value: DiBag.withAcquisitionMetadata(opaque, value => ({ value })) }).end();
const annotated = DiBag.withAcquisitionMetadata(({ dep }: { dep: number }) => dep, value => ({ value }));
// diagnostic: missing factories
DiBag.begin().add({ annotated }).end();
// diagnostic: wrong shape
DiBag.begin().add({ annotated, dep: () => 'wrong' });
// diagnostic: read-only
DiBag.begin().add({ value: DiBag.withAcquisitionMetadata(() => 1, value => ({ value })) }).end().inspect('value').acquisitions[0]!.metadata[0] = { present: false };
