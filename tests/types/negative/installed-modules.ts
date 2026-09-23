import { DiBag } from '../../../src';
import type { Module } from '../../../src';

const logging = DiBag.createBuilder()
  .withServices({ logger: () => ({ log: (line: string) => line }) })
  .buildModule({ exportedServiceKeys: ['logger'] });
const feature = DiBag.createBuilder()
  .withServices({ service: ({ logger }: { logger: { log(line: string): string } }) => ({ read: () => logger.log('x') }) })
  .buildModule({ exportedServiceKeys: ['service'] });
const numericLogger = DiBag.createBuilder()
  .withServices({ logger: () => ({ log: (line: number) => String(line) }) })
  .buildModule({ exportedServiceKeys: ['logger'] });

// Two modules of one list export the same name: the SECOND element is the offender.
DiBag.createBuilder().withInstalledModules([
  logging,
  feature,
  // diagnostic: withServices and withTokenService introduce new names or typed tokens only
  logging,
]);

// A module export collides with the builder.
DiBag.createBuilder().withServices({ logger: () => ({ log: (line: string) => line }) }).withInstalledModules([
  feature,
  // diagnostic: withServices and withTokenService introduce new names or typed tokens only
  logging,
]);

// A later module provides the wrong type for an earlier module's requirement.
DiBag.createBuilder().withInstalledModules([
  feature,
  // diagnostic: provided service does not satisfy its consumer dependency
  numericLogger,
]);

// An element that is not a module.
DiBag.createBuilder().withInstalledModules([
  feature,
  // diagnostic: withInstalledModules requires a finite tuple of genuine modules
  42,
]);

// A widened array has no positions to check.
declare const widened: Module<object, object>[];
// diagnostic: withInstalledModules requires a finite tuple of genuine modules
DiBag.createBuilder().withInstalledModules(widened);

// A missing requirement is still reported by the terminal, as it is for separate installs.
// diagnostic: required service registrations are missing
DiBag.createBuilder().withInstalledModules([feature]).buildContainer();
