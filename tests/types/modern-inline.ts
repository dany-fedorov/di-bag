import { DiBag, type ProviderOutput, type ProviderNeeds, type ProviderMetadata,
  type ProviderAcquisitionMetadata, type ValBoxFrame } from '../../src';
import type { ProviderFactory } from '../../src/provider';
import { fromValBox } from '../../src/val-box';
import type { Assert, Equal } from './assert';

export const raw = { snapshot(this: { snapshot: unknown }) {
  return { value: { present: true as const, value: Promise.resolve(42) },
    metadata: { present: true as const, value: { owner: 'db' } }, alias: null };
} };
const factory = () => ({ snapshot() { return {
  value: { present: true as const, value: raw },
  metadata: { present: false as const }, alias: '',
}; } });
const predeclared = fromValBox(factory);
export const inline = fromValBox(() => ({ snapshot() { return {
  value: { present: true as const, value: raw },
  metadata: { present: false as const }, alias: '',
}; } }));
export const twice = fromValBox(inline);
const predeclaredTwice = fromValBox(predeclared);
type SnapshotChecks = [
  Assert<Equal<ProviderOutput<typeof inline>, typeof raw>>,
  Assert<Equal<ProviderNeeds<typeof inline>, Record<never, never>>>,
  Assert<Equal<ProviderFactory<typeof inline>, (this: void, deps: Record<never, never>) => typeof raw>>,
  Assert<Equal<ProviderMetadata<typeof inline>, Readonly<{}>>>,
  Assert<Equal<ProviderOutput<typeof twice>, Promise<number>>>,
  Assert<Equal<ProviderAcquisitionMetadata<typeof twice>, readonly [ValBoxFrame<never>, ValBoxFrame<{owner:string}>]>>,
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
