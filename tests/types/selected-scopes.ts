import { DiBag } from '../../src';

const key: unique symbol = Symbol('service');
export const serviceToken = DiBag.createToken(key).forService<{ read(): number }>();
const feature = DiBag.createBuilder().withServices({
  privateValue: ({ config }: { config: { id: string } }) => config.id,
  service: ({ privateValue }: { privateValue: string }) => ({ id: privateValue }),
}).buildModule({ exportedServiceKeys: ['service'] }).withRenamedExport({ currentExportKey: 'service', newExportKey: 'exported' });
export const parent = DiBag.createBuilder().withInstalledModules([feature]).withTokenService(serviceToken, () => ({ read: () => 1 })).withServices({
  config: () => ({ id: 'parent' }),
  asyncValue: async () => ({ read: () => Number(1) }),
  raw: DiBag.providerWithRegistrationMetadata({ provider: DiBag.createProvider(() => Promise.resolve(1), { factoryReturnKind: 'uninspected' }), registrationMetadata: { name: 'raw' as const } }),
}).buildContainer();
export const child = parent.createChildContainer(['config', serviceToken, 'asyncValue'], {
  config: () => ({ id: 'child', added: true as const }),
  [key]: () => ({ read: () => 2, tokenExtra: 'exact' as const }),
  asyncValue: async () => ({ read: () => 2, extra() { return 'async' as const; } }),
}, { sharedParentServiceKeys: ['exported', 'raw'] });
export const grandchild = child.createChildContainer({ sharedParentServiceKeys: [serviceToken, 'asyncValue'] });
export const fork = child.createIndependentContainer(['config'], { config: () => ({ id: 'fork', added: true as const }) });

export const roots = DiBag.createBuilder().withServices({
  config: DiBag.providerWithLifetime({ provider: () => ({ id: 'parent' }), lifetime: 'singleton:one-per-container-tree' }),
  service: DiBag.providerWithLifetime({ provider: ({ config }: { config: { id: string } }) => ({ config }), lifetime: 'singleton:one-per-container-tree' }),
}).buildContainer();
export const overriddenRootDependency = roots.createChildContainer(['config'], { config: () => ({ id: 'child' }) });
export const childRoot = roots.createChildContainer(['service'], {
  service: DiBag.providerWithLifetime({ provider: ({ config }: { config: { id: string } }) => ({ config, owned: true as const }), lifetime: 'singleton:one-per-container-tree' }),
});
