import { DiBag } from 'di-bag';

const acquisitionMode = 'raw' as const;
const shared = { acquisitionMode: 'raw' } as const;

export const query = DiBag.fromFactory(() => ({ then: (done: (rows: string[]) => void) => done([]) }), { acquisitionMode: 'raw' });
export const quoted = DiBag.fromFactory(async () => 1, { "acquisitionMode": "nativePromise" });
export const shorthand = DiBag.fromFactory(() => 2, { acquisitionMode });
export const spread = DiBag.fromFactory(() => 3, { ...shared });
export const cache = DiBag.withLifetime(() => new Map<string, string>(), 'root');
export const scoped = DiBag.withLifetime(() => new Map<string, string>(), `scoped`);
export const described = DiBag.withMetadata(() => ({ id: 7 }), {
  static: { owner: 'billing' },
  dynamic: { mode: 'direct', describe: value => ({ id: value.id }) },
});
const lifetime = 'root' as const;
export const indirect = DiBag.withLifetime(() => 1, lifetime);
