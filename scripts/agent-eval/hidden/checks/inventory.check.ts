// The module installs with fixtures for exactly its contract's requirements and exports its contract.
import { DiBag } from 'di-bag';
import type { Catalog } from '../../src/features/catalog/contract.js';
import type { Inventory, StockLevels } from '../../src/features/inventory/contract.js';
import { inventoryModule } from '../../src/features/inventory/module.js';

const builder = DiBag.createBuilder()
  .withInstalledModules([inventoryModule])
  .withServices({
    stockLevels: DiBag.providerWithLifetime({ provider: (): StockLevels => ({}), lifetime: 'singleton:one-per-container-tree' }),
    catalog: DiBag.providerWithLifetime({ provider: (): Catalog => ({ find: () => undefined, list: () => [] }), lifetime: 'singleton:one-per-container-tree' }),
  });

builder.verifyGraphAtCompileTime() satisfies void;
export const exported = (): Inventory => builder.buildContainer().resolve('inventory');
