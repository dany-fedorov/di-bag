import { DiBag } from '../../../src';
import { feature } from '../module-erasure/feature';
// diagnostic: root lifetime cannot capture scoped dependency: api -> external
DiBag.createBuilder().installModule(feature).register({ external: () => 'x', api: DiBag.withLifetime(({ passthrough }: { passthrough: () => number }) => passthrough(), 'root') }).build();
// diagnostic: root lifetime cannot capture scoped dependency: api -> external
DiBag.createBuilder().installModule(feature.renameExport('passthrough', 'through')).register({ external: () => 'x', api: DiBag.withLifetime(({ through }: { through: () => number }) => through(), 'root') }).build();
// The seal-time captive case (`buildModule` rejecting a private root over a private scoped service) needs plan 07
// Task 4; see the `## Status` section of docs/superpowers/plans/2026-09-13-07-module-declaration-erasure.md.
// diagnostic: provided service does not satisfy its consumer dependency
DiBag.createBuilder().installModule(feature).register({ external: () => 'x' }).replace('service', () => ({ read: (_key: string) => 'text' }));
