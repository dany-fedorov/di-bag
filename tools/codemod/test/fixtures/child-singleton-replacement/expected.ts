import { DiBag } from 'di-bag';

const root = DiBag.createBuilder().withServices({
  config: DiBag.providerWithLifetime({ provider: () => ({ region: 'eu' }), lifetime: 'scoped:one-per-container' }),
  client: DiBag.providerWithLifetime({ provider: ({ config }: { config: { region: string } }) => config.region, lifetime: 'singleton:one-per-container-tree', allowsScopedDependencies: true }),
}).buildContainer();

export const child = root.createChildContainer(['config'], { config: () => ({ region: 'us' }) });
