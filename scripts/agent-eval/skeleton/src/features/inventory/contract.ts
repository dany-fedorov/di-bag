// inventoryModule exports `inventory`; the host registers `stockLevels`, and
// `catalog` comes from catalogModule.
import type { Catalog } from '../catalog/contract.js';

/** Units in stock per SKU when the application starts. Registered by the host as singleton per container tree. */
export type StockLevels = Readonly<Record<string, number>>;

/** Stock reservations held by one request scope. */
export type Inventory = {
  /** Units of the SKU neither sold nor reserved, across the application. */
  available(sku: string): number;
  /** Reserves units for this scope; false, reserving nothing, if the SKU is not in the catalog or stock is short. */
  reserve(sku: string, quantity: number): boolean;
  /** Turns this scope's reservations into sales. */
  commit(): void;
};

export type InventoryExports = { inventory: Inventory };
export type InventoryRequirements = { stockLevels: StockLevels; catalog: Catalog };
