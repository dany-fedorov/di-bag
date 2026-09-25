import { DiBag } from 'di-bag';

const root = DiBag.createBuilder().withServices({
  config: DiBag.providerWithLifetime({ provider: () => ({ region: 'eu' }), lifetime: 'scoped:one-per-container' }),
  middle: DiBag.providerWithLifetime({ provider: ({ config }: { config: { region: string } }) => config.region, lifetime: 'singleton:one-per-container-tree', allowsScopedDependencies: true }),
  client: DiBag.providerWithLifetime({ provider: ({ middle }: { middle: string }) => middle, lifetime: 'singleton:one-per-container-tree', allowsScopedDependencies: true }),
}).buildContainer();
const child = root.createChildContainer(['config'], { config: () => ({ region: 'us' }) });
const grandchild = child.createChildContainer(['config'], { config: () => ({ region: 'ca' }) });
export { child, grandchild };
