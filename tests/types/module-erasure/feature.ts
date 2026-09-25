import { DiBag } from '../../../src';

/** Private type: must not appear in the emitted declaration, so this file does not export it. */
type PrivateCacheShape = { entries: Map<string, number> };
const tokenKey = Symbol('token');
export const tokenService = DiBag.createToken(tokenKey).forService<{ id: number }>();

export const feature = DiBag.createBuilder()
  .withServices({
    privateCache: DiBag.providerWithLifetime({ provider: (): PrivateCacheShape => ({ entries: new Map() }), lifetime: 'singleton:one-per-container-tree' }),
    // Private root with an external need: its key survives only as a quoted `consumer` and `root` value.
    privateHelper: DiBag.providerWithLifetime({ provider: ({ privateCache, clock }: { privateCache: PrivateCacheShape; clock: () => number }) => (key: string) => (privateCache.entries.get(key) ?? 0) + clock(), lifetime: 'singleton:one-per-container-tree' }),
    // Exported strict root over private roots: no obligation survives sealing.
    service: DiBag.providerWithLifetime({ provider: ({ privateHelper }: { privateHelper: (key: string) => number }) => ({ read: (key: string) => privateHelper(key) }), lifetime: 'singleton:one-per-container-tree' }),
    // Exported transient over an external requirement: a carrier obligation reaching `external`.
    passthrough: DiBag.providerWithLifetime({ provider: ({ external, privateHelper }: { external: string; privateHelper: (key: string) => number }) => () => privateHelper(external), lifetime: 'transient:one-per-resolve' }),
    // Private consumer of an export: a checked constraint the host must keep satisfying.
    privateConsumer: ({ service }: { service: { read(key: string): number } }) => service.read('x'),
  })
  .withTokenService(tokenService, () => ({ id: 1 }))
  .buildModule({ exportedServiceKeys: ['service', 'passthrough', tokenService] });
