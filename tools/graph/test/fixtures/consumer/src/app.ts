import { DiBag } from 'di-bag/node';
import type { Clock } from './features/invoicing/contract.js';
import { fulfillmentModule } from './features/fulfillment/module.js';
import { invoicingModule } from './features/invoicing/module.js';

export const app = DiBag.createBuilder()
  .installModule(fulfillmentModule)
  .installModule(invoicingModule)
  .register({ clock: (): Clock => ({ now: () => 0 }) })
  .build();
