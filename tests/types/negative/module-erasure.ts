import { DiBag } from '../../../src';
import { feature } from '../module-erasure/feature';
const clock = DiBag.providerWithLifetime({ provider: () => () => 0, lifetime: 'singleton:one-per-container-tree' });
// diagnostic: root lifetime cannot capture scoped dependency: api -> external; see https://dany-fedorov.github.io/di-bag/agent/errors.html#root-capture
DiBag.createBuilder().withInstalledModules([feature]).withServices({ external: DiBag.providerWithLifetime({ provider: () => 'x', lifetime: 'scoped:one-per-container' }), clock, api: DiBag.providerWithLifetime({ provider: ({ passthrough }: { passthrough: () => number }) => passthrough(), lifetime: 'singleton:one-per-container-tree' }) }).buildContainer();
// diagnostic: root lifetime cannot capture scoped dependency: api -> external; see https://dany-fedorov.github.io/di-bag/agent/errors.html#root-capture
DiBag.createBuilder().withInstalledModules([feature.withRenamedExport({ currentExportKey: 'passthrough', newExportKey: 'through' })]).withServices({ external: DiBag.providerWithLifetime({ provider: () => 'x', lifetime: 'scoped:one-per-container' }), clock, api: DiBag.providerWithLifetime({ provider: ({ through }: { through: () => number }) => through(), lifetime: 'singleton:one-per-container-tree' }) }).buildContainer();
const helper = DiBag.createBuilder().withServices({ helper: DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'scoped:one-per-container' }), api: DiBag.providerWithLifetime({ provider: ({ helper }: { helper: number }) => helper, lifetime: 'singleton:one-per-container-tree' }) });
// diagnostic: root lifetime cannot capture scoped dependency: api -> helper; see https://dany-fedorov.github.io/di-bag/agent/errors.html#root-capture
helper.buildModule({ exportedServiceKeys: [] });
// diagnostic: provided service does not satisfy its consumer dependency
DiBag.createBuilder().withInstalledModules([feature]).withServices({ external: DiBag.providerWithLifetime({ provider: () => 'x', lifetime: 'scoped:one-per-container' }), clock }).withReplacedService('service', DiBag.providerWithLifetime({ provider: () => ({ read: (_key: string) => 'text' }), lifetime: 'scoped:one-per-container' }));
// The private root keeps its provenance as a quoted `root` value in the sealed obligation.
// diagnostic: root lifetime cannot capture scoped dependency: privateHelper -> clock; see https://dany-fedorov.github.io/di-bag/agent/errors.html#root-capture
DiBag.createBuilder().withInstalledModules([feature]).withServices({ external: DiBag.providerWithLifetime({ provider: () => 'x', lifetime: 'scoped:one-per-container' }), clock: DiBag.providerWithLifetime({ provider: () => () => 0, lifetime: 'scoped:one-per-container' }) }).buildContainer();
