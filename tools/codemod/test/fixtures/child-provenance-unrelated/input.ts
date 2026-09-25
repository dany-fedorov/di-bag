import { DiBag } from 'di-bag';

export const unrelated = DiBag.createBuilder().register({
  config: DiBag.withLifetime(() => ({ region: 'a' }), 'root'),
  client: DiBag.withLifetime(({ config }: { config: { region: string } }) => config.region, 'root'),
}).build();

const root = DiBag.createBuilder().register({
  config: DiBag.withLifetime(() => ({ region: 'b' }), 'root'),
  client: DiBag.withLifetime(({ config }: { config: { region: string } }) => config.region, 'root'),
}).build();
const alias = root;
export const child = alias.createScope(['config'], { config: () => ({ region: 'child' }) });
