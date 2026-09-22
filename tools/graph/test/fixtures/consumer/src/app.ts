import { DiBag } from 'di-bag';
import type { Clock } from './features/invoicing/contract.js';
import { fulfillmentModule } from './features/fulfillment/module.js';
import { invoicingModule } from './features/invoicing/module.js';

export const app = DiBag.createBuilder()
  .withInstalledModules([fulfillmentModule])
  .withInstalledModules([invoicingModule])
  .withServices({ clock: (): Clock => ({ now: () => 0 }) })
  .buildContainer();
