import { DiBag } from '../../src';

const key: unique symbol = Symbol('service');
export const serviceToken = DiBag.createToken(key).forService<{ read(): number }>();
const feature = DiBag.createBuilder().withServices({
  privateValue: DiBag.providerWithLifetime({ provider: ({ config }: { config: { id: string } }) => config.id, lifetime: 'scoped:one-per-container' }),
  service: DiBag.providerWithLifetime({ provider: ({ privateValue }: { privateValue: string }) => ({ id: privateValue }), lifetime: 'scoped:one-per-container' }),
}).buildModule({ exportedServiceKeys: ['service'] }).withRenamedExport({ currentExportKey: 'service', newExportKey: 'exported' });
export const parent = DiBag.createBuilder().withInstalledModules([feature]).withTokenService(serviceToken, DiBag.providerWithLifetime({ provider: (): { read(): number } => ({ read: () => 1 }), lifetime: 'scoped:one-per-container' })).withServices({
  config: DiBag.providerWithLifetime({ provider: () => ({ id: 'parent' }), lifetime: 'scoped:one-per-container' }),
  asyncValue: DiBag.providerWithLifetime({ provider: async () => ({ read: () => Number(1) }), lifetime: 'scoped:one-per-container' }),
  raw: DiBag.providerWithLifetime({ provider: DiBag.providerWithRegistrationMetadata({ provider: DiBag.createProvider(() => Promise.resolve(1), { factoryReturnKind: 'uninspected' }), registrationMetadata: { name: 'raw' as const } }), lifetime: 'scoped:one-per-container' }),
}).buildContainer();
export const child = parent.createChildContainer(['config', serviceToken, 'asyncValue'], {
  config: DiBag.providerWithLifetime({ provider: () => ({ id: 'child', added: true as const }), lifetime: 'scoped:one-per-container' }),
  [key]: DiBag.providerWithLifetime({ provider: (): { read: () => number; tokenExtra: 'exact' } => ({ read: () => 2, tokenExtra: 'exact' as const }), lifetime: 'scoped:one-per-container' }),
  asyncValue: DiBag.providerWithLifetime({ provider: async (): Promise<{ read: () => number; extra(): 'async' }> => ({ read: () => 2, extra() { return 'async' as const; } }), lifetime: 'scoped:one-per-container' }),
}, { sharedParentServiceKeys: ['exported', 'raw'] });
export const grandchild = child.createChildContainer({ sharedParentServiceKeys: [serviceToken, 'asyncValue'] });
export const fork = child.createIndependentContainer(['config'], { config: DiBag.providerWithLifetime({ provider: () => ({ id: 'fork', added: true as const }), lifetime: 'scoped:one-per-container' }) });

export const roots = DiBag.createBuilder().withServices({
  config: DiBag.providerWithLifetime({ provider: () => ({ id: 'parent' }), lifetime: 'singleton:one-per-container-tree' }),
  service: DiBag.providerWithLifetime({ provider: ({ config }: { config: { id: string } }) => ({ config }), lifetime: 'singleton:one-per-container-tree' }),
}).buildContainer();
export const overriddenRootDependency = roots.createChildContainer(['config'], { config: DiBag.providerWithLifetime({ provider: () => ({ id: 'child' }), lifetime: 'scoped:one-per-container' }) });
export const childRoot = roots.createChildContainer(['service'], {
  service: DiBag.providerWithLifetime({ provider: ({ config }: { config: { id: string } }) => ({ config, owned: true as const }), lifetime: 'singleton:one-per-container-tree' }),
});
