import { DiBag } from 'di-bag';
import type { Fulfillment } from './contract.js';
import { createStock, type Stock } from './stock.js';

export const fulfillmentModule = DiBag.createBuilder()
  .withServices({
    stock: createStock,
    fulfillment: ({ stock }: { stock: Stock }): Fulfillment => ({
      reserve: (sku, quantity) => stock.take(sku, quantity),
    }),
  })
  .buildModule({ exportedServiceKeys: ['fulfillment'] });
