import { DiBag } from '../../../src';
import { feature } from '../module-erasure/feature';
const clock = DiBag.withLifetime(() => () => 0, 'root');
// diagnostic: root lifetime cannot capture scoped dependency: api -> external; see https://dany-fedorov.github.io/di-bag/agent/errors.html#root-capture
DiBag.createBuilder().installModule(feature).register({ external: () => 'x', clock, api: DiBag.withLifetime(({ passthrough }: { passthrough: () => number }) => passthrough(), 'root') }).build();
// diagnostic: root lifetime cannot capture scoped dependency: api -> external; see https://dany-fedorov.github.io/di-bag/agent/errors.html#root-capture
DiBag.createBuilder().installModule(feature.renameExport('passthrough', 'through')).register({ external: () => 'x', clock, api: DiBag.withLifetime(({ through }: { through: () => number }) => through(), 'root') }).build();
const helper = DiBag.createBuilder().register({ helper: () => 1, api: DiBag.withLifetime(({ helper }: { helper: number }) => helper, 'root') });
// diagnostic: root lifetime cannot capture scoped dependency: api -> helper; see https://dany-fedorov.github.io/di-bag/agent/errors.html#root-capture
helper.buildModule([]);
// diagnostic: provided service does not satisfy its consumer dependency
DiBag.createBuilder().installModule(feature).register({ external: () => 'x', clock }).replace('service', () => ({ read: (_key: string) => 'text' }));
// The private root keeps its provenance as a quoted `root` value in the sealed obligation.
// diagnostic: root lifetime cannot capture scoped dependency: privateHelper -> clock; see https://dany-fedorov.github.io/di-bag/agent/errors.html#root-capture
DiBag.createBuilder().installModule(feature).register({ external: () => 'x', clock: () => () => 0 }).build();
