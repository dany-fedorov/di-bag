import { DiBag } from 'di-bag';
const clockSymbol = Symbol('clock'); const clock = DiBag.token(clockSymbol).of<{ now(): number }>();
const Configured = DiBag.withConfiguration({ runtime: { isNativePromise: value => value instanceof Promise } });
export const kept = Configured.fromFunction([clock], value => /* keep positional comment */ Promise.resolve(value.now()), { acquisitionMode: 'nativePromise' });
const shared = { acquisitionMode: 'raw' as const };
export const manual = Configured.fromFactory(() => 1, shared);
