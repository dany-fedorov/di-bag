// The module installs with fixtures for exactly its contract's requirements and exports its contract.
import { DiBag } from 'di-bag';
import type { Catalog } from '../../src/features/catalog/contract.js';
import type { Inventory, StockLevels } from '../../src/features/inventory/contract.js';
import { inventoryModule } from '../../src/features/inventory/module.js';

const builder = DiBag.createBuilder()
  .installModule(inventoryModule)
  .register({
    stockLevels: DiBag.withLifetime((): StockLevels => ({}), 'root'),
    catalog: DiBag.withLifetime((): Catalog => ({ find: () => undefined, list: () => [] }), 'root'),
  });

builder.verifyGraph() satisfies void;
export const exported = (): Inventory => builder.build().resolve('inventory');
