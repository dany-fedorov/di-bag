import { DiBag } from '../../src';

const key: unique symbol = Symbol('service');
export const serviceToken = DiBag.token(key).of<{ read(): number }>();
const feature = DiBag.module().add({
  privateValue: ({ config }: { config: { id: string } }) => config.id,
  service: ({ privateValue }: { privateValue: string }) => ({ id: privateValue }),
}).exports(['service']).rename('service', 'exported');
export const parent = DiBag.begin().install(feature).bind(serviceToken, () => ({ read: () => 1 })).add({
  config: () => ({ id: 'parent' }),
  asyncValue: async () => ({ read: () => Number(1) }),
  raw: DiBag.withMetadata(DiBag.factory(() => Promise.resolve(1), { acquisition: 'raw' }), { name: 'raw' as const }),
}).end();
export const child = parent.scope(['config', serviceToken, 'asyncValue'], {
  config: () => ({ id: 'child', added: true as const }),
  [key]: () => ({ read: () => 2, tokenExtra: 'exact' as const }),
  asyncValue: async () => ({ read: () => 2, extra() { return 'async' as const; } }),
}, { share: ['exported', 'raw'] });
export const grandchild = child.scope({ share: [serviceToken, 'asyncValue'] });
export const fork = child.fork(['config'], { config: () => ({ id: 'fork', added: true as const }) });

export const roots = DiBag.begin().add({
  config: DiBag.withLifetime(() => ({ id: 'parent' }), 'root'),
  service: DiBag.withLifetime(({ config }: { config: { id: string } }) => ({ config }), 'root'),
}).end();
export const overriddenRootDependency = roots.scope(['config'], { config: () => ({ id: 'child' }) });
export const childRoot = roots.scope(['service'], {
  service: DiBag.withLifetime(({ config }: { config: { id: string } }) => ({ config, owned: true as const }), 'root'),
});
