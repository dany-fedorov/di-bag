import { DiBag, type ModuleRequires } from '../../../src';
import { database, databaseKey, feature, publicFeature } from './feature';
import type { Assert, Equal } from '../assert';
const bag = DiBag.begin().install(feature.rename('handler', 'first')).install(feature.rename('handler', 'second'))
  .add({ ordinary: () => true }).bind(database, () => ({ read: () => 3, extra: true as const })).end();
const first = bag.resolve('first'); const second = bag.resolve('second'); const db = bag.resolve(database);
const publicBag = DiBag.begin().install(publicFeature).end(); const publicDb = publicBag.resolve(database);
type Exact = [Assert<Equal<typeof first, { run: () => number; id: number }>>, Assert<Equal<typeof second, typeof first>>,
  Assert<Equal<typeof db, { read: () => number; extra: true }>>, Assert<Equal<typeof publicDb, { read: () => number; rich: true }>>,
  Assert<Equal<ModuleRequires<typeof feature>, Readonly<{ [databaseKey]: { read(): number } }>>>];
// @ts-expect-error the external token must survive exports and later ordinary add
DiBag.begin().install(feature).add({ ordinary: () => 1 }).end();
