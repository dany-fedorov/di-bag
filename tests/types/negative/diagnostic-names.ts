import { DiBag, type Overrides } from '../../../src';
// fork and createScope usually reject a wrong override first through the factory context; the named report is the Overrides verdict.
declare const override: Overrides<{ port: () => number }, { port: () => string }>;
// diagnostic: override value is not assignable to the original token: port; see https://dany-fedorov.github.io/di-bag/agent/errors.html#wrong-override
override satisfies void;
// diagnostic: required service registrations are missing: clock; see https://dany-fedorov.github.io/di-bag/agent/errors.html#missing-service
DiBag.createBuilder().withServices({ db: DiBag.providerWithLifetime({ provider: ({ clock }: { clock: number }) => clock, lifetime: 'scoped:one-per-container' }) }).buildContainer();
// diagnostic: provided service does not satisfy its consumer dependency; see https://dany-fedorov.github.io/di-bag/agent/errors.html#wrong-shape
DiBag.createBuilder().withServices({ config: DiBag.providerWithLifetime({ provider: () => ({ retries: '3' }), lifetime: 'scoped:one-per-container' }), db: DiBag.providerWithLifetime({ provider: ({ config }: { config: { retries: number } }) => config.retries, lifetime: 'scoped:one-per-container' }) });
const accepted = DiBag.createBuilder().withServices({ config: DiBag.providerWithLifetime({ provider: () => ({ retries: 3 }), lifetime: 'scoped:one-per-container' }) });
// diagnostic: provided service does not satisfy its consumer dependency; see https://dany-fedorov.github.io/di-bag/agent/errors.html#wrong-shape
accepted.withServices({ db: DiBag.providerWithLifetime({ provider: ({ config }: { config: { retries: string } }) => config.retries, lifetime: 'scoped:one-per-container' }) });
const bag = DiBag.createBuilder().withServices({ config: DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'scoped:one-per-container' }) }).buildContainer();
// diagnostic: createIndependentContainer accepts existing names or typed tokens only: unknown missing; see https://dany-fedorov.github.io/di-bag/agent/errors.html#unknown-key
bag.createIndependentContainer(['missing'], { missing: DiBag.providerWithLifetime({ provider: () => 2, lifetime: 'scoped:one-per-container' }) });
// diagnostic: withReplacedService requires one existing singleton string-literal key: absent; see https://dany-fedorov.github.io/di-bag/agent/errors.html#unknown-key
DiBag.createBuilder().withServices({ config: DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'scoped:one-per-container' }) }).withReplacedService('absent', DiBag.providerWithLifetime({ provider: () => 2, lifetime: 'scoped:one-per-container' }));
// diagnostic: root lifetime cannot capture scoped dependency: db -> config; see https://dany-fedorov.github.io/di-bag/agent/errors.html#root-capture
DiBag.createBuilder().withServices({ config: DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'scoped:one-per-container' }), db: DiBag.providerWithLifetime({ provider: ({ config }: { config: number }) => config, lifetime: 'singleton:one-per-container-tree' }) }).buildContainer();
const scoped = DiBag.createBuilder().withServices({ config: DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'scoped:one-per-container' }), db: DiBag.providerWithLifetime({ provider: ({ config }: { config: number }) => config, lifetime: 'scoped:one-per-container' }) }).buildContainer();
// diagnostic: root lifetime cannot capture scoped dependency: db -> config; see https://dany-fedorov.github.io/di-bag/agent/errors.html#root-capture
scoped.createChildContainer(['db'], { db: DiBag.providerWithLifetime({ provider: ({ config }: { config: number }) => config, lifetime: 'singleton:one-per-container-tree' }) });
const feature = DiBag.createBuilder().withServices({
  value: DiBag.providerWithLifetime({ provider: () => ({ read() { return 1; }, extra() { return true; } }), lifetime: 'scoped:one-per-container' }),
  hidden: DiBag.providerWithLifetime({ provider: ({ value }: { value: { extra(): boolean } }) => value.extra(), lifetime: 'scoped:one-per-container' }),
}).buildModule({ exportedServiceKeys: ['value'] });
// diagnostic: provided service does not satisfy its consumer dependency; see https://dany-fedorov.github.io/di-bag/agent/errors.html#wrong-shape
DiBag.createBuilder().withInstalledModules([feature]).withReplacedService('value', DiBag.providerWithLifetime({ provider: () => ({ read() { return 2; } }), lifetime: 'scoped:one-per-container' }));
const needy = DiBag.createBuilder().withServices({ hidden: DiBag.providerWithLifetime({ provider: ({ external }: { external: number }) => external, lifetime: 'scoped:one-per-container' }) }).buildModule({ exportedServiceKeys: [] });
// diagnostic: required service registrations are missing: external; see https://dany-fedorov.github.io/di-bag/agent/errors.html#missing-service
DiBag.createBuilder().withInstalledModules([needy]).buildContainer();
