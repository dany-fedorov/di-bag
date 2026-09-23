import { DiBag } from 'di-bag';
import type { Catalog } from '../catalog/contract.js';
import type { StockLevels } from './contract.js';
import { inventoryModule } from './module.js';

DiBag.createBuilder()
  .withInstalledModules([inventoryModule])
  .withServices({
    stockLevels: DiBag.providerWithLifetime({ provider: (): StockLevels => ({}), lifetime: 'singleton:one-per-container-tree' }),
    catalog: DiBag.providerWithLifetime({ provider: (): Catalog => ({ find: () => undefined, list: () => [] }), lifetime: 'singleton:one-per-container-tree' }),
  })
  .verifyGraphAtCompileTime() satisfies void;
