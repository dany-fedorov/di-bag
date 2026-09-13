import { DiBag } from '../../../src';
import { feature } from '../module-erasure/feature';
// diagnostic: root lifetime cannot capture scoped dependency: api -> external
DiBag.createBuilder().installModule(feature).register({ external: () => 'x', api: DiBag.withLifetime(({ passthrough }: { passthrough: () => number }) => passthrough(), 'root') }).build();
// diagnostic: root lifetime cannot capture scoped dependency: api -> external
DiBag.createBuilder().installModule(feature.renameExport('passthrough', 'through')).register({ external: () => 'x', api: DiBag.withLifetime(({ through }: { through: () => number }) => through(), 'root') }).build();
const helper = DiBag.createBuilder().register({ helper: () => 1, api: DiBag.withLifetime(({ helper }: { helper: number }) => helper, 'root') });
// diagnostic: root lifetime cannot capture scoped dependency: api -> helper
helper.buildModule([]);
// diagnostic: provided service does not satisfy its consumer dependency: privateConsumer needs service
DiBag.createBuilder().installModule(feature).register({ external: () => 'x' }).replace('service', () => ({ read: (_key: string) => 'text' }));
