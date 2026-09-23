import { DiBag } from 'di-bag';
import type { AcquisitionMode } from 'di-bag';

const clockSymbol = Symbol('clock'); const clock = DiBag.token(clockSymbol).of<{ now(): number }>();
type Dependencies = readonly [typeof clock];
type ReadClock = (clock: { now(): number }) => number;
class Client { constructor(readonly clock: { now(): number }) {} }

export const factory = DiBag.fromFactory<() => number, 'raw'>(() => 1, { acquisitionMode: 'raw' });
export const union = DiBag.fromFactory<() => Promise<number>, 'raw' | 'nativePromise'>(() => Promise.resolve(1), { acquisitionMode: 'raw' });
export const positional = DiBag.fromFunction<Dependencies, ReadClock, 'raw'>([clock], value => value.now(), { acquisitionMode: 'raw' });
export const constructed = DiBag.fromClass<Dependencies, typeof Client, 'raw'>([clock], Client, { acquisitionMode: 'raw' });
export const plugin = DiBag.fromPlugin<Dependencies, { run(): void }, 'raw'>([clock], { apiVersion: 1, create: () => ({ run() {} }) }, { acquisitionMode: 'raw', validate: (value): value is { run(): void } => typeof value === 'object' && value !== null });
export const unresolved = DiBag.fromFactory<() => never, AcquisitionMode>(() => { throw new Error('never'); });
