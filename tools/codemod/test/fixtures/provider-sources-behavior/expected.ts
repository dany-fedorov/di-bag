import { DiBag } from 'di-bag';
const clockSymbol = Symbol('clock'); const clock = DiBag.createToken(clockSymbol).forService<{ now(): number }>();
const Configured = DiBag.withConfiguration({ runtime: { isNativePromise: value => value instanceof Promise } });
export const kept = Configured.createProviderFromFunction({ dependencies: [clock], factoryFunction: value => /* keep positional comment */ Promise.resolve(value.now()), factoryReturnKind: 'native-promise' });
const shared = { acquisitionMode: 'raw' as const };
export const manual = Configured.fromFactory(() => 1, shared);
