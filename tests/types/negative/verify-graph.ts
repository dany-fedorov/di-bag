import { DiBag } from '../../../src';
const incomplete = DiBag.createBuilder().register({ db: ({ config }: { config: { url: string } }) => config.url });
// diagnostic: required service registrations are missing: config; see https://dany-fedorov.github.io/di-bag/agent/errors.html#missing-service
incomplete.verifyGraph() satisfies void;
const captive = DiBag.createBuilder().register({ config: () => 1, db: DiBag.withLifetime(({ config }: { config: number }) => config, 'root') });
// diagnostic: root lifetime cannot capture scoped dependency: db -> config; see https://dany-fedorov.github.io/di-bag/agent/errors.html#root-capture
captive.verifyGraph() satisfies void;
// register reports the generic wrong shape; verifyGraph() prints the details and names the unsatisfied-consumer section.
// diagnostic: provided service does not satisfy its consumer dependency; see https://dany-fedorov.github.io/di-bag/agent/errors.html#wrong-shape
const mismatched = DiBag.createBuilder().register({ port: () => 'eighty', server: ({ port }: { port: number }) => port + 1 });
// diagnostic: provided service does not satisfy its consumer dependency; see https://dany-fedorov.github.io/di-bag/agent/errors.html#unsatisfied-consumer
mismatched.verifyGraph() satisfies void;
