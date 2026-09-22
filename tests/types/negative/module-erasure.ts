import { DiBag } from '../../../src';
import { feature } from '../module-erasure/feature';
const clock = DiBag.withLifetime(() => () => 0, 'root');
// diagnostic: root lifetime cannot capture scoped dependency: api -> external; see https://dany-fedorov.github.io/di-bag/agent/errors.html#root-capture
DiBag.createBuilder().withInstalledModules([feature]).withServices({ external: () => 'x', clock, api: DiBag.withLifetime(({ passthrough }: { passthrough: () => number }) => passthrough(), 'root') }).buildContainer();
// diagnostic: root lifetime cannot capture scoped dependency: api -> external; see https://dany-fedorov.github.io/di-bag/agent/errors.html#root-capture
DiBag.createBuilder().withInstalledModules([feature.withRenamedExport({ currentExportKey: 'passthrough', newExportKey: 'through' })]).withServices({ external: () => 'x', clock, api: DiBag.withLifetime(({ through }: { through: () => number }) => through(), 'root') }).buildContainer();
const helper = DiBag.createBuilder().withServices({ helper: () => 1, api: DiBag.withLifetime(({ helper }: { helper: number }) => helper, 'root') });
// diagnostic: root lifetime cannot capture scoped dependency: api -> helper; see https://dany-fedorov.github.io/di-bag/agent/errors.html#root-capture
helper.buildModule({ exportedServiceKeys: [] });
// diagnostic: provided service does not satisfy its consumer dependency
DiBag.createBuilder().withInstalledModules([feature]).withServices({ external: () => 'x', clock }).withReplacedService('service', () => ({ read: (_key: string) => 'text' }));
// The private root keeps its provenance as a quoted `root` value in the sealed obligation.
// diagnostic: root lifetime cannot capture scoped dependency: privateHelper -> clock; see https://dany-fedorov.github.io/di-bag/agent/errors.html#root-capture
DiBag.createBuilder().withInstalledModules([feature]).withServices({ external: () => 'x', clock: () => () => 0 }).buildContainer();
