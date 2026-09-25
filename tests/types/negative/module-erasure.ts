import { DiBag } from '../../../src';
import { feature } from '../module-erasure/feature';
const clock = DiBag.providerWithLifetime({ provider: () => () => 0, lifetime: 'singleton:one-per-container-tree' });
// diagnostic: singleton lifetime cannot capture scoped dependency: api -> external; see https://dany-fedorov.github.io/di-bag/agent/errors.html#singleton-captures-scoped
DiBag.createBuilder().withInstalledModules([feature]).withServices({ external: () => 'x', clock, api: DiBag.providerWithLifetime({ provider: ({ passthrough }: { passthrough: () => number }) => passthrough(), lifetime: 'singleton:one-per-container-tree' }) }).buildContainer();
// diagnostic: singleton lifetime cannot capture scoped dependency: api -> external; see https://dany-fedorov.github.io/di-bag/agent/errors.html#singleton-captures-scoped
DiBag.createBuilder().withInstalledModules([feature.withRenamedExport({ currentExportKey: 'passthrough', newExportKey: 'through' })]).withServices({ external: () => 'x', clock, api: DiBag.providerWithLifetime({ provider: ({ through }: { through: () => number }) => through(), lifetime: 'singleton:one-per-container-tree' }) }).buildContainer();
const helper = DiBag.createBuilder().withServices({ helper: () => 1, api: DiBag.providerWithLifetime({ provider: ({ helper }: { helper: number }) => helper, lifetime: 'singleton:one-per-container-tree' }) });
// diagnostic: singleton lifetime cannot capture scoped dependency: api -> helper; see https://dany-fedorov.github.io/di-bag/agent/errors.html#singleton-captures-scoped
helper.buildModule({ exportedServiceKeys: [] });
// diagnostic: provided service does not satisfy its consumer dependency
DiBag.createBuilder().withInstalledModules([feature]).withServices({ external: () => 'x', clock }).withReplacedService('service', () => ({ read: (_key: string) => 'text' }));
// The private root keeps its provenance as a quoted `root` value in the sealed obligation.
// diagnostic: singleton lifetime cannot capture scoped dependency: privateHelper -> clock; see https://dany-fedorov.github.io/di-bag/agent/errors.html#singleton-captures-scoped
DiBag.createBuilder().withInstalledModules([feature]).withServices({ external: () => 'x', clock: () => () => 0 }).buildContainer();
