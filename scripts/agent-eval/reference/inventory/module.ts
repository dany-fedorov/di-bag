import { DiBag } from 'di-bag';
import type { Catalog } from '../catalog/contract.js';
import type { Inventory, StockLevels } from './contract.js';
import { createHolds, createLedger, type Holds, type Ledger } from './ledger.js';

export const inventoryModule = DiBag.createBuilder()
  .withServices({
    ledger: DiBag.providerWithLifetime({ provider: ({ stockLevels }: { stockLevels: StockLevels }) => createLedger(stockLevels), lifetime: 'singleton:one-per-container-tree' }),
    holds: DiBag.providerWithLifetime({ provider: DiBag.providerWithDisposal({ provider: ({ ledger }: { ledger: Ledger }) => createHolds(ledger), disposeService: holds => holds.release() }), lifetime: 'scoped:one-per-container' }),
    inventory: DiBag.providerWithLifetime({ provider: ({ catalog, ledger, holds }: { catalog: Catalog; ledger: Ledger; holds: Holds }): Inventory => ({
      available: sku => ledger.available(sku),
      reserve: (sku, quantity) => catalog.find(sku) !== undefined && holds.hold(sku, quantity),
      commit: () => holds.commit(),
    }), lifetime: 'scoped:one-per-container' }),
  })
  .buildModule({ exportedServiceKeys: ['inventory'], moduleLabel: 'inventory' });
