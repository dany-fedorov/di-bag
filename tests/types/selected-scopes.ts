import { DiBag } from '../../src';

const key: unique symbol = Symbol('service');
export const serviceToken = DiBag.token(key).of<{ read(): number }>();
const feature = DiBag.createModuleBuilder().register({
  privateValue: ({ config }: { config: { id: string } }) => config.id,
  service: ({ privateValue }: { privateValue: string }) => ({ id: privateValue }),
}).buildModule(['service']).renameExport('service', 'exported');
export const parent = DiBag.createBuilder().installModule(feature).register(serviceToken, () => ({ read: () => 1 })).register({
  config: () => ({ id: 'parent' }),
  asyncValue: async () => ({ read: () => Number(1) }),
  raw: DiBag.withMetadata(DiBag.fromFactory(() => Promise.resolve(1), { acquisitionMode: 'raw' }), { static: { name: 'raw' as const } }),
}).build();
export const child = parent.createScope(['config', serviceToken, 'asyncValue'], {
  config: () => ({ id: 'child', added: true as const }),
  [key]: () => ({ read: () => 2, tokenExtra: 'exact' as const }),
  asyncValue: async () => ({ read: () => 2, extra() { return 'async' as const; } }),
}, { share: ['exported', 'raw'] });
export const grandchild = child.createScope({ share: [serviceToken, 'asyncValue'] });
export const fork = child.fork(['config'], { config: () => ({ id: 'fork', added: true as const }) });

export const roots = DiBag.createBuilder().register({
  config: DiBag.withLifetime(() => ({ id: 'parent' }), 'root'),
  service: DiBag.withLifetime(({ config }: { config: { id: string } }) => ({ config }), 'root'),
}).build();
export const overriddenRootDependency = roots.createScope(['config'], { config: () => ({ id: 'child' }) });
export const childRoot = roots.createScope(['service'], {
  service: DiBag.withLifetime(({ config }: { config: { id: string } }) => ({ config, owned: true as const }), 'root'),
});
