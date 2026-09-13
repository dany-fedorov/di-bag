import { DiBag } from '../../../src';
const incomplete = DiBag.createBuilder().register({ db: ({ config }: { config: { url: string } }) => config.url });
// diagnostic: required service registrations are missing: config
incomplete.verifyGraph() satisfies void;
const captive = DiBag.createBuilder().register({ config: () => 1, db: DiBag.withLifetime(({ config }: { config: number }) => config, 'root') });
// diagnostic: root lifetime cannot capture scoped dependency: db -> config
captive.verifyGraph() satisfies void;
