import { DiBag } from '../../../src';
const incomplete = DiBag.createBuilder().withServices({ db: ({ config }: { config: { url: string } }) => config.url });
// diagnostic: required service registrations are missing: config; see https://dany-fedorov.github.io/di-bag/agent/errors.html#missing-service
incomplete.verifyGraphAtCompileTime() satisfies void;
const captive = DiBag.createBuilder().withServices({ config: () => 1, db: DiBag.providerWithLifetime({ provider: ({ config }: { config: number }) => config, lifetime: 'singleton:one-per-container-tree' }) });
// diagnostic: root lifetime cannot capture scoped dependency: db -> config; see https://dany-fedorov.github.io/di-bag/agent/errors.html#root-capture
captive.verifyGraphAtCompileTime() satisfies void;
// withServices reports the generic wrong shape; verifyGraphAtCompileTime() prints the details and names the unsatisfied-consumer section.
// diagnostic: provided service does not satisfy its consumer dependency; see https://dany-fedorov.github.io/di-bag/agent/errors.html#wrong-shape
const mismatched = DiBag.createBuilder().withServices({ port: () => 'eighty', server: ({ port }: { port: number }) => port + 1 });
// diagnostic: provided service does not satisfy its consumer dependency; see https://dany-fedorov.github.io/di-bag/agent/errors.html#unsatisfied-consumer
mismatched.verifyGraphAtCompileTime() satisfies void;
