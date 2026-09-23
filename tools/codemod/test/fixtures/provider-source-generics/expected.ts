import { DiBag } from 'di-bag';
import type { FactoryReturnKind } from 'di-bag';

const clockSymbol = Symbol('clock'); const clock = DiBag.createToken(clockSymbol).forService<{ now(): number }>();
type Dependencies = readonly [typeof clock];
type ReadClock = (clock: { now(): number }) => number;
class Client { constructor(readonly clock: { now(): number }) {} }

export const factory = DiBag.createProvider<() => number, 'uninspected'>(() => 1, { factoryReturnKind: 'uninspected' });
export const union = DiBag.createProvider<() => Promise<number>, 'uninspected' | 'native-promise'>(() => Promise.resolve(1), { factoryReturnKind: 'uninspected' });
export const positional = DiBag.createProviderFromFunction<Dependencies, ReadClock, 'uninspected'>({ dependencies: [clock], factoryFunction: value => value.now(), factoryReturnKind: 'uninspected' });
export const constructed = DiBag.createProviderFromClass<Dependencies, typeof Client, 'uninspected'>({ dependencies: [clock], serviceClass: Client, factoryReturnKind: 'uninspected' });
export const plugin = DiBag.createProviderFromPlugin<Dependencies, { run(): void }, 'uninspected'>({ dependencies: [clock], pluginDescriptor: { apiVersion: 1, create: () => ({ run() {} }) }, factoryReturnKind: 'uninspected', isValidPluginOutput: (value): value is { run(): void } => typeof value === 'object' && value !== null });
export const unresolved = DiBag.createProvider<() => never, FactoryReturnKind>(() => { throw new Error('never'); });
