import { DiBag } from '../../../src';
// diagnostic: required service registrations are missing: clock; see https://dany-fedorov.github.io/di-bag/agent/errors.html#missing-service
DiBag.createBuilder().register({ db: ({ clock }: { clock: number }) => clock }).build();
// diagnostic: provided service does not satisfy its consumer dependency; see https://dany-fedorov.github.io/di-bag/agent/errors.html#wrong-shape
DiBag.createBuilder().register({ config: () => ({ retries: '3' }), db: ({ config }: { config: { retries: number } }) => config.retries });
const accepted = DiBag.createBuilder().register({ config: () => ({ retries: 3 }) });
// diagnostic: provided service does not satisfy its consumer dependency; see https://dany-fedorov.github.io/di-bag/agent/errors.html#wrong-shape
accepted.register({ db: ({ config }: { config: { retries: string } }) => config.retries });
const bag = DiBag.createBuilder().register({ config: () => 1 }).build();
// diagnostic: fork accepts existing names or typed tokens only: unknown missing; see https://dany-fedorov.github.io/di-bag/agent/errors.html#unknown-key
bag.fork(['missing'], { missing: () => 2 });
// diagnostic: replace requires one existing singleton string-literal key: absent; see https://dany-fedorov.github.io/di-bag/agent/errors.html#unknown-key
DiBag.createBuilder().register({ config: () => 1 }).replace('absent', () => 2);
// diagnostic: root lifetime cannot capture scoped dependency: db -> config; see https://dany-fedorov.github.io/di-bag/agent/errors.html#root-capture
DiBag.createBuilder().register({ config: () => 1, db: DiBag.withLifetime(({ config }: { config: number }) => config, 'root') }).build();
const scoped = DiBag.createBuilder().register({ config: () => 1, db: ({ config }: { config: number }) => config }).build();
// diagnostic: root lifetime cannot capture scoped dependency: db -> config; see https://dany-fedorov.github.io/di-bag/agent/errors.html#root-capture
scoped.createScope(['db'], { db: DiBag.withLifetime(({ config }: { config: number }) => config, 'root') });
const feature = DiBag.createBuilder().register({
  value: () => ({ read() { return 1; }, extra() { return true; } }),
  hidden: ({ value }: { value: { extra(): boolean } }) => value.extra(),
}).buildModule(['value']);
// diagnostic: provided service does not satisfy its consumer dependency; see https://dany-fedorov.github.io/di-bag/agent/errors.html#wrong-shape
DiBag.createBuilder().installModule(feature).replace('value', () => ({ read() { return 2; } }));
const needy = DiBag.createBuilder().register({ hidden: ({ external }: { external: number }) => external }).buildModule([]);
// diagnostic: required service registrations are missing: external; see https://dany-fedorov.github.io/di-bag/agent/errors.html#missing-service
DiBag.createBuilder().installModule(needy).build();
