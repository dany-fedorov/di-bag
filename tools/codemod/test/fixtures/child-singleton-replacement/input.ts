import { DiBag } from 'di-bag';

const root = DiBag.createBuilder().register({
  config: DiBag.withLifetime(() => ({ region: 'eu' }), 'root'),
  client: DiBag.withLifetime(({ config }: { config: { region: string } }) => config.region, 'root'),
}).build();

export const child = root.createScope(['config'], { config: () => ({ region: 'us' }) });
