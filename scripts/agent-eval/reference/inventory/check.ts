import { DiBag } from 'di-bag/node';
import type { Catalog } from '../catalog/contract.js';
import type { StockLevels } from './contract.js';
import { inventoryModule } from './module.js';

DiBag.createBuilder()
  .installModule(inventoryModule)
  .register({
    stockLevels: DiBag.withLifetime((): StockLevels => ({}), 'root'),
    catalog: DiBag.withLifetime((): Catalog => ({ find: () => undefined, list: () => [] }), 'root'),
  })
  .verifyGraph() satisfies void;
