import { DiBag, type Provider } from '../../../src';
const source = DiBag.withMetadata(({ clock }: { clock: number }) => ({ value: clock }), { owner: 'team' });
// diagnostic: not assignable
DiBag.mapSync(source, (value: { value: string }) => value);
// diagnostic: not assignable
DiBag.mapAsync(source, (value: { value: string }) => value);
// diagnostic: not assignable
DiBag.mapSync(() => Promise.resolve(1), (value: number) => value);
// diagnostic: not assignable
DiBag.mapSync(source, function (this: { prefix: string }, value) { return this.prefix + value.value; });
// diagnostic: not assignable
DiBag.mapAsync(source, function (this: { prefix: string }, value) { return this.prefix + value.value; });
const mapped = DiBag.mapSync(source, value => value.value);
// diagnostic: missing factories
DiBag.begin().add({ mapped }).end();
// diagnostic: wrong shape
DiBag.begin().add({ mapped, clock: () => 'wrong' });
// diagnostic: not assignable
DiBag.withDisposal(mapped, (value: string) => {});
// diagnostic: not assignable
DiBag.mapSync({ ...mapped }, value => value);
// diagnostic: not assignable
const erased: Provider<() => number, {}, readonly []> = mapped;
type Registration = Parameters<typeof DiBag.withMetadata>[0];
declare const opaque: Exclude<Registration, ((...args: never[]) => unknown) | { create: unknown }>;
// diagnostic: not assignable
DiBag.mapSync(opaque, (value: number) => value);
// diagnostic: not assignable
DiBag.mapAsync(opaque, (value: number) => value);
// diagnostic: factory dependencies must be finite
// diagnostic-also: TS2684 missing factories
DiBag.begin().add({ mapped: DiBag.mapSync(opaque, () => 1) }).end();
// diagnostic: factory dependencies must be finite
// diagnostic-also: TS2684 missing factories
DiBag.begin().add({ mapped: DiBag.mapAsync(opaque, () => 1) }).end();
// diagnostic: factory dependencies must be finite
// diagnostic-also: TS2684 missing factories
DiBag.begin().add({ mapped: DiBag.withDisposal(DiBag.mapSync(opaque, () => 1), () => {}) }).end();
// diagnostic: factory dependencies must be finite
// diagnostic-also: TS2684 missing factories
DiBag.begin().add({ mapped: DiBag.mapAsync(DiBag.withDisposal(opaque, () => {}), () => 1) }).end();
declare const wrapped: NoInfer<Registration>;
// diagnostic: factory dependencies must be finite
// diagnostic-also: TS2684 missing factories
DiBag.begin().add({ mapped: DiBag.mapSync(wrapped, () => 1) }).end();
// diagnostic: factory dependencies must be finite
// diagnostic-also: TS2684 missing factories
DiBag.begin().add({ mapped: DiBag.mapAsync(wrapped, () => 1) }).end();
// diagnostic: factory dependencies must be finite
// diagnostic-also: TS2684 missing factories
DiBag.begin().add({ mapped: DiBag.withDisposal(wrapped, () => {}) }).end();
// diagnostic: factory dependencies must be finite
DiBag.module().add({ mapped: DiBag.withDisposal(DiBag.mapAsync(wrapped, () => 1), () => {}) }).exports(['mapped']);
// diagnostic: read-only
DiBag.withDisposal(() => 1, () => {}).create = () => 2;
// diagnostic: not assignable
DiBag.withDisposal(() => 1, function (this: { cleanup(): void }, value: number) { this.cleanup(); });
// diagnostic: not assignable
DiBag.withDisposal(mapped, function (this: { cleanup(): void }, value: number) { this.cleanup(); });
