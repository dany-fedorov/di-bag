import { DiBag } from 'di-bag';

const root = DiBag.createBuilder().register({
  config: DiBag.withLifetime(() => ({ region: 'eu' }), 'root'),
  middle: DiBag.withLifetime(({ config }: { config: { region: string } }) => config.region, 'root'),
  client: DiBag.withLifetime(({ middle }: { middle: string }) => middle, 'root'),
}).build();
const child = root.createScope(['config'], { config: () => ({ region: 'us' }) });
const grandchild = child.createScope(['config'], { config: () => ({ region: 'ca' }) });
export { child, grandchild };
