import { DiBag, type Overrides } from '../../../src';
// fork and createScope usually reject a wrong override first through the factory context; the named report is the Overrides verdict.
declare const override: Overrides<{ port: () => number }, { port: () => string }>;
// diagnostic: override value is not assignable to the original token: port; see https://dany-fedorov.github.io/di-bag/agent/errors.html#wrong-override
override satisfies void;
// diagnostic: required service registrations are missing: clock; see https://dany-fedorov.github.io/di-bag/agent/errors.html#missing-service
DiBag.createBuilder().withServices({ db: ({ clock }: { clock: number }) => clock }).buildContainer();
// diagnostic: provided service does not satisfy its consumer dependency; see https://dany-fedorov.github.io/di-bag/agent/errors.html#wrong-shape
DiBag.createBuilder().withServices({ config: () => ({ retries: '3' }), db: ({ config }: { config: { retries: number } }) => config.retries });
const accepted = DiBag.createBuilder().withServices({ config: () => ({ retries: 3 }) });
// diagnostic: provided service does not satisfy its consumer dependency; see https://dany-fedorov.github.io/di-bag/agent/errors.html#wrong-shape
accepted.withServices({ db: ({ config }: { config: { retries: string } }) => config.retries });
const bag = DiBag.createBuilder().withServices({ config: () => 1 }).buildContainer();
// diagnostic: fork accepts existing names or typed tokens only: unknown missing; see https://dany-fedorov.github.io/di-bag/agent/errors.html#unknown-key
bag.fork(['missing'], { missing: () => 2 });
// diagnostic: replace requires one existing singleton string-literal key: absent; see https://dany-fedorov.github.io/di-bag/agent/errors.html#unknown-key
DiBag.createBuilder().withServices({ config: () => 1 }).withReplacedService('absent', () => 2);
// diagnostic: root lifetime cannot capture scoped dependency: db -> config; see https://dany-fedorov.github.io/di-bag/agent/errors.html#root-capture
DiBag.createBuilder().withServices({ config: () => 1, db: DiBag.withLifetime(({ config }: { config: number }) => config, 'root') }).buildContainer();
const scoped = DiBag.createBuilder().withServices({ config: () => 1, db: ({ config }: { config: number }) => config }).buildContainer();
// diagnostic: root lifetime cannot capture scoped dependency: db -> config; see https://dany-fedorov.github.io/di-bag/agent/errors.html#root-capture
scoped.createScope(['db'], { db: DiBag.withLifetime(({ config }: { config: number }) => config, 'root') });
const feature = DiBag.createBuilder().withServices({
  value: () => ({ read() { return 1; }, extra() { return true; } }),
  hidden: ({ value }: { value: { extra(): boolean } }) => value.extra(),
}).buildModule({ exportedServiceKeys: ['value'] });
// diagnostic: provided service does not satisfy its consumer dependency; see https://dany-fedorov.github.io/di-bag/agent/errors.html#wrong-shape
DiBag.createBuilder().withInstalledModules([feature]).withReplacedService('value', () => ({ read() { return 2; } }));
const needy = DiBag.createBuilder().withServices({ hidden: ({ external }: { external: number }) => external }).buildModule({ exportedServiceKeys: [] });
// diagnostic: required service registrations are missing: external; see https://dany-fedorov.github.io/di-bag/agent/errors.html#missing-service
DiBag.createBuilder().withInstalledModules([needy]).buildContainer();
