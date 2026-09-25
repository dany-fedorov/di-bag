import { DiBag } from 'di-bag';

export const unrelated = DiBag.createBuilder().withServices({
  config: DiBag.providerWithLifetime({ provider: () => ({ region: 'a' }), lifetime: 'singleton:one-per-container-tree' }),
  client: DiBag.providerWithLifetime({ provider: ({ config }: { config: { region: string } }) => config.region, lifetime: 'singleton:one-per-container-tree' }),
}).buildContainer();

const root = DiBag.createBuilder().withServices({
  config: DiBag.providerWithLifetime({ provider: () => ({ region: 'b' }), lifetime: 'scoped:one-per-container' }),
  client: DiBag.providerWithLifetime({ provider: ({ config }: { config: { region: string } }) => config.region, lifetime: 'singleton:one-per-container-tree', allowsScopedDependencies: true }),
}).buildContainer();
const alias = root;
export const child = alias.createChildContainer(['config'], { config: () => ({ region: 'child' }) });
