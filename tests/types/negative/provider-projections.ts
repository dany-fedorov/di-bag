import { DiBag, type Provider } from '../../../src';
const source = DiBag.withMetadata(({ clock }: { clock: number }) => ({ value: clock }), { static: { owner: 'team' } });
// diagnostic: not assignable
DiBag.transformService(source, { mode: 'direct', transform: (value: { value: string }) => value });
// diagnostic: not assignable
DiBag.transformService(source, { mode: 'awaited', transform: (value: { value: string }) => value });
// diagnostic: not assignable
DiBag.transformService(() => Promise.resolve(1), { mode: 'direct', transform: (value: number) => value });
// diagnostic: not assignable
DiBag.transformService(source, { mode: 'direct', transform: function (this: { prefix: string }, value) { return this.prefix + value.value; } });
// diagnostic: not assignable
DiBag.transformService(source, { mode: 'awaited', transform: function (this: { prefix: string }, value) { return this.prefix + value.value; } });
const mapped = DiBag.transformService(source, { mode: 'direct', transform: value => value.value });
// diagnostic: required service registrations are missing
DiBag.createBuilder().register({ mapped }).build();
// diagnostic: consumer dependency
DiBag.createBuilder().register({ mapped, clock: () => 'wrong' });
// diagnostic: not assignable
DiBag.withDisposal(mapped, (value: string) => {});
// diagnostic: not assignable
DiBag.transformService({ ...mapped }, { mode: 'direct', transform: value => value });
// diagnostic: not assignable
const erased: Provider<() => number, {}, readonly []> = mapped;
type Registration = Parameters<typeof DiBag.withMetadata>[0];
declare const opaque: Exclude<Registration, ((...args: never[]) => unknown) | { create: unknown }>;
// diagnostic: not assignable
DiBag.transformService(opaque, { mode: 'direct', transform: (value: number) => value });
// diagnostic: not assignable
DiBag.transformService(opaque, { mode: 'awaited', transform: (value: number) => value });
// diagnostic: factory dependencies must be finite
// diagnostic-also: TS2684 required service registrations are missing
DiBag.createBuilder().register({ mapped: DiBag.transformService(opaque, { mode: 'direct', transform: () => 1 }) }).build();
// diagnostic: factory dependencies must be finite
// diagnostic-also: TS2684 required service registrations are missing
DiBag.createBuilder().register({ mapped: DiBag.transformService(opaque, { mode: 'awaited', transform: () => 1 }) }).build();
// diagnostic: factory dependencies must be finite
// diagnostic-also: TS2684 required service registrations are missing
DiBag.createBuilder().register({ mapped: DiBag.withDisposal(DiBag.transformService(opaque, { mode: 'direct', transform: () => 1 }), () => {}) }).build();
// diagnostic: factory dependencies must be finite
// diagnostic-also: TS2684 required service registrations are missing
DiBag.createBuilder().register({ mapped: DiBag.transformService(DiBag.withDisposal(opaque, () => {}), { mode: 'awaited', transform: () => 1 }) }).build();
declare const wrapped: NoInfer<Registration>;
// diagnostic: factory dependencies must be finite
// diagnostic-also: TS2684 required service registrations are missing
DiBag.createBuilder().register({ mapped: DiBag.transformService(wrapped, { mode: 'direct', transform: () => 1 }) }).build();
// diagnostic: factory dependencies must be finite
// diagnostic-also: TS2684 required service registrations are missing
DiBag.createBuilder().register({ mapped: DiBag.transformService(wrapped, { mode: 'awaited', transform: () => 1 }) }).build();
// diagnostic: factory dependencies must be finite
// diagnostic-also: TS2684 required service registrations are missing
DiBag.createBuilder().register({ mapped: DiBag.withDisposal(wrapped, () => {}) }).build();
// diagnostic: factory dependencies must be finite
DiBag.createBuilder().register({ mapped: DiBag.withDisposal(DiBag.transformService(wrapped, { mode: 'awaited', transform: () => 1 }), () => {}) }).buildModule(['mapped']);
// diagnostic: read-only
DiBag.withDisposal(() => 1, () => {}).create = () => 2;
// diagnostic: not assignable
DiBag.withDisposal(() => 1, function (this: { cleanup(): void }, value: number) { this.cleanup(); });
// diagnostic: not assignable
DiBag.withDisposal(mapped, function (this: { cleanup(): void }, value: number) { this.cleanup(); });
