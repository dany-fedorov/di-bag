import { DiBag, type ModuleRequiredServices } from '../../../src';
import { database, databaseKey, feature, publicFeature } from './feature';
import type { Assert, Equal } from '../assert';
const bag = DiBag.createBuilder().installModule(feature.renameExport('handler', 'first')).installModule(feature.renameExport('handler', 'second')).register({ ordinary: () => true }).register(database, () => ({ read: () => 3, extra: true as const })).build();
const first = bag.resolve('first'); const second = bag.resolve('second'); const db = bag.resolve(database);
const publicBag = DiBag.createBuilder().installModule(publicFeature).build(); const publicDb = publicBag.resolve(database);
type Exact = [Assert<Equal<typeof first, { run: () => number; id: number }>>, Assert<Equal<typeof second, typeof first>>,
  Assert<Equal<typeof db, { read: () => number; extra: true }>>, Assert<Equal<typeof publicDb, { read: () => number; rich: true }>>,
  Assert<Equal<ModuleRequiredServices<typeof feature>, Readonly<{ [databaseKey]: { read(): number } }>>>];
// @ts-expect-error the external token must survive exports and later ordinary add
DiBag.createBuilder().installModule(feature).register({ ordinary: () => 1 }).build();
