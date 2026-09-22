import { DiBag, type ModuleRequiredServices } from '../../../src';
import { database, databaseKey, feature, publicFeature } from './feature';
import type { Assert, Equal } from '../assert';
const bag = DiBag.createBuilder().withInstalledModules([feature.renameExport('handler', 'first')]).withInstalledModules([feature.renameExport('handler', 'second')]).withServices({ ordinary: () => true }).withTokenService(database, () => ({ read: () => 3, extra: true as const })).buildContainer();
const first = bag.resolve('first'); const second = bag.resolve('second'); const db = bag.resolve(database);
const publicBag = DiBag.createBuilder().withInstalledModules([publicFeature]).buildContainer(); const publicDb = publicBag.resolve(database);
type Exact = [Assert<Equal<typeof first, { run: () => number; id: number }>>, Assert<Equal<typeof second, typeof first>>,
  Assert<Equal<typeof db, { read: () => number; extra: true }>>, Assert<Equal<typeof publicDb, { read: () => number; rich: true }>>,
  Assert<Equal<ModuleRequiredServices<typeof feature>, Readonly<{ [databaseKey]: { read(): number } }>>>];
// @ts-expect-error the external token must survive exports and later ordinary add
DiBag.createBuilder().withInstalledModules([feature]).withServices({ ordinary: () => 1 }).buildContainer();
