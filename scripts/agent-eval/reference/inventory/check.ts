import { DiBag } from 'di-bag';
import type { Catalog } from '../catalog/contract.js';
import type { StockLevels } from './contract.js';
import { inventoryModule } from './module.js';

DiBag.createBuilder()
  .withInstalledModules([inventoryModule])
  .withServices({
    stockLevels: DiBag.withLifetime((): StockLevels => ({}), 'root'),
    catalog: DiBag.withLifetime((): Catalog => ({ find: () => undefined, list: () => [] }), 'root'),
  })
  .verifyGraphAtCompileTime() satisfies void;
