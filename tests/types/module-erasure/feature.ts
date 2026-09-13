import { DiBag } from '../../../src';

/** Private type: must not appear in the emitted declaration. */
export type PrivateCacheShape = { entries: Map<string, number> };
const tokenKey = Symbol('token');
export const tokenService = DiBag.token(tokenKey).of<{ id: number }>();

export const feature = DiBag.createBuilder()
  .register({
    privateCache: DiBag.withLifetime((): PrivateCacheShape => ({ entries: new Map() }), 'root'),
    privateHelper: DiBag.withLifetime(({ privateCache }: { privateCache: PrivateCacheShape }) => (key: string) => privateCache.entries.get(key) ?? 0, 'root'),
    // Exported strict root over private roots: no obligation survives sealing.
    service: DiBag.withLifetime(({ privateHelper }: { privateHelper: (key: string) => number }) => ({ read: (key: string) => privateHelper(key) }), 'root'),
    // Exported transient over an external requirement: a carrier obligation reaching `external`.
    passthrough: DiBag.withLifetime(({ external, privateHelper }: { external: string; privateHelper: (key: string) => number }) => () => privateHelper(external), 'transient'),
    // Private consumer of an export: a checked constraint the host must keep satisfying.
    privateConsumer: ({ service }: { service: { read(key: string): number } }) => service.read('x'),
  })
  .register(tokenService, () => ({ id: 1 }))
  .buildModule(['service', 'passthrough', tokenService]);
