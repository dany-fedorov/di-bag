import { DiBag, type ProviderOutput, type ProviderNeeds, type ProviderMetadata,
  type ProviderAcquisitionMetadata } from '../../src';
import type { ProviderFactory } from '../../src/provider';
import type { Assert, Equal } from './assert';

export const raw = { value: Promise.resolve(42), metadata: { owner: 'db' } };
const factory = () => ({ value: raw });
const predeclared = DiBag.mapSync(DiBag.withAcquisitionMetadata(factory, () => ({})), result => result.value);
export const inline = DiBag.mapSync(DiBag.withAcquisitionMetadata(() => ({ value: raw }), () => ({})), result => result.value);
export const twice = DiBag.mapSync(DiBag.withAcquisitionMetadata(inline, result => result.metadata), result => result.value);
const predeclaredTwice = DiBag.mapSync(DiBag.withAcquisitionMetadata(predeclared, result => result.metadata), result => result.value);
type SnapshotChecks = [
  Assert<Equal<ProviderOutput<typeof inline>, typeof raw>>,
  Assert<Equal<ProviderNeeds<typeof inline>, Record<never, never>>>,
  Assert<Equal<ProviderFactory<typeof inline>, (this: void, deps: Record<never, never>) => typeof raw>>,
  Assert<Equal<ProviderMetadata<typeof inline>, Readonly<{}>>>,
  Assert<Equal<ProviderOutput<typeof twice>, Promise<number>>>,
  Assert<Equal<ProviderAcquisitionMetadata<typeof twice>, readonly [Readonly<{}>, Readonly<{owner:string}>]>>,
  Assert<Equal<ProviderOutput<typeof predeclared>, typeof raw>>,
  Assert<Equal<ProviderOutput<typeof predeclaredTwice>, Promise<number>>>,
];
const providers = {
  service: () => ({ read() { return Number(1); }, extra() { return true; } }),
  promised: async () => 7,
};
const root = DiBag.begin().add(providers).end();
const overrides = {
  service: () => ({ read() { return 3; }, extra() { return true; }, richer() { return 9; } }),
  promised: async ({service}: {service: {richer(): number}}) => service.richer(),
};
const predeclaredFork = root.fork(['service', 'promised'], overrides);
const inlineFork = root.fork(['service', 'promised'], {
  service: () => ({ read() { return 3; }, extra() { return true; }, richer() { return 9; } }),
  promised: async ({service}: {service: {richer(): number}}) => service.richer(),
});
export const inlineService = inlineFork.resolve('service');
export const inlinePromised = inlineFork.resolve('promised');
type ForkChecks = [
  Assert<Equal<typeof inlineService, {read(): number; extra(): boolean; richer(): number}>>,
  Assert<Equal<typeof inlinePromised, Promise<number>>>,
];
const control: number = predeclaredFork.resolve('service').richer();
