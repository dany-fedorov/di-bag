import { DiBag, type ProviderOutput, type ProviderNamedDependencies, type ProviderRegistrationMetadata,
  type ProviderAcquisitionMetadata } from '../../src';
import type { ProviderFactory } from '../../src/provider';
import type { Assert, Equal } from './assert';

export const raw = { value: Promise.resolve(42), metadata: { owner: 'db' } };
const factory = () => ({ value: raw });
const predeclared = DiBag.providerWithTransformedService({ provider: DiBag.providerWithAcquisitionMetadata({ provider: factory, describeAcquisition: () => ({}), callbackReceives: 'exposed-service' }), transformService: result => result.value, callbackReceives: 'exposed-service' });
export const inline = DiBag.providerWithTransformedService({ provider: DiBag.providerWithAcquisitionMetadata({ provider: () => ({ value: raw }), describeAcquisition: () => ({}), callbackReceives: 'exposed-service' }), transformService: result => result.value, callbackReceives: 'exposed-service' });
export const twice = DiBag.providerWithTransformedService({ provider: DiBag.providerWithAcquisitionMetadata({ provider: inline, describeAcquisition: result => result.metadata, callbackReceives: 'exposed-service' }), transformService: result => result.value, callbackReceives: 'exposed-service' });
const predeclaredTwice = DiBag.providerWithTransformedService({ provider: DiBag.providerWithAcquisitionMetadata({ provider: predeclared, describeAcquisition: result => result.metadata, callbackReceives: 'exposed-service' }), transformService: result => result.value, callbackReceives: 'exposed-service' });
type SnapshotChecks = [
  Assert<Equal<ProviderOutput<typeof inline>, typeof raw>>,
  Assert<Equal<ProviderNamedDependencies<typeof inline>, Record<never, never>>>,
  Assert<Equal<ProviderFactory<typeof inline>, () => typeof raw>>,
  Assert<Equal<ProviderRegistrationMetadata<typeof inline>, Readonly<{}>>>,
  Assert<Equal<ProviderOutput<typeof twice>, Promise<number>>>,
  Assert<Equal<ProviderAcquisitionMetadata<typeof twice>, readonly [Readonly<{}>, Readonly<{owner:string}>]>>,
  Assert<Equal<ProviderOutput<typeof predeclared>, typeof raw>>,
  Assert<Equal<ProviderOutput<typeof predeclaredTwice>, Promise<number>>>,
];
const providers = {
  service: () => ({ read() { return Number(1); }, extra() { return true; } }),
  promised: async () => 7,
};
const root = DiBag.createBuilder().withServices(providers).buildContainer();
const overrides = {
  service: () => ({ read() { return 3; }, extra() { return true; }, richer() { return 9; } }),
  promised: async ({service}: {service: {richer(): number}}) => service.richer(),
};
const predeclaredFork = root.createIndependentContainer(['service', 'promised'], overrides);
const inlineFork = root.createIndependentContainer(['service', 'promised'], {
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
