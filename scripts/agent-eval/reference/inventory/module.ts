import { DiBag } from 'di-bag/node';
import type { Catalog } from '../catalog/contract.js';
import type { Inventory, StockLevels } from './contract.js';
import { createHolds, createLedger, type Holds, type Ledger } from './ledger.js';

export const inventoryModule = DiBag.createBuilder()
  .register({
    ledger: DiBag.withLifetime(({ stockLevels }: { stockLevels: StockLevels }) => createLedger(stockLevels), 'root'),
    holds: DiBag.withDisposal(({ ledger }: { ledger: Ledger }) => createHolds(ledger), holds => holds.release()),
    inventory: ({ catalog, ledger, holds }: { catalog: Catalog; ledger: Ledger; holds: Holds }): Inventory => ({
      available: sku => ledger.available(sku),
      reserve: (sku, quantity) => catalog.find(sku) !== undefined && holds.hold(sku, quantity),
      commit: () => holds.commit(),
    }),
  })
  .buildModule(['inventory'], { label: 'inventory' });
