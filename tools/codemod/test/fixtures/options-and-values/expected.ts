import { DiBag } from 'di-bag';

const acquisitionMode = 'raw' as const;
const shared = { acquisitionMode: 'raw' } as const;

export const query = DiBag.createProvider(() => ({ then: (done: (rows: string[]) => void) => done([]) }), { factoryReturnKind: 'uninspected' });
export const quoted = DiBag.createProvider(async () => 1, { "factoryReturnKind": "native-promise" });
export const shorthand = DiBag.createProvider(() => 2, { factoryReturnKind: acquisitionMode });
export const spread = DiBag.createProvider(() => 3, { ...shared });
export const cache = DiBag.withLifetime(() => new Map<string, string>(), 'singleton:one-per-container-tree');
export const scoped = DiBag.withLifetime(() => new Map<string, string>(), `scoped`);
export const described = DiBag.withMetadata(() => ({ id: 7 }), {
  registrationMetadata: { owner: 'billing' },
  dynamic: { mode: 'exposed-service', describeAcquisition: value => ({ id: value.id }) },
});
const lifetime = 'root' as const;
export const indirect = DiBag.withLifetime(() => 1, lifetime);
