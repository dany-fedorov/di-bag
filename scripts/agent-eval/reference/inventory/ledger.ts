import type { StockLevels } from './contract.js';

export function createLedger(stockLevels: StockLevels) {
  const units = new Map(Object.entries(stockLevels));
  return {
    available: (sku: string) => units.get(sku) ?? 0,
    take(sku: string, quantity: number) {
      const left = units.get(sku) ?? 0;
      if (left < quantity) return false;
      units.set(sku, left - quantity);
      return true;
    },
    give(sku: string, quantity: number) {
      units.set(sku, (units.get(sku) ?? 0) + quantity);
    },
  };
}
export type Ledger = ReturnType<typeof createLedger>;

export function createHolds(ledger: Ledger) {
  const held: Array<[string, number]> = [];
  return {
    hold(sku: string, quantity: number) {
      if (!ledger.take(sku, quantity)) return false;
      held.push([sku, quantity]);
      return true;
    },
    commit() {
      held.length = 0;
    },
    release() {
      for (const [sku, quantity] of held.splice(0)) ledger.give(sku, quantity);
    },
  };
}
export type Holds = ReturnType<typeof createHolds>;
