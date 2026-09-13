import { DiBag } from 'di-bag/node';
import type { Catalog } from '../catalog/contract.js';
import type { Inventory } from '../inventory/contract.js';
import type { Notifier } from '../notifications/contract.js';
import type { PaymentGateway } from './contract.js';
import { checkoutModule } from './module.js';

DiBag.createBuilder()
  .installModule(checkoutModule)
  .register({
    catalog: DiBag.withLifetime((): Catalog => ({ find: () => undefined, list: () => [] }), 'root'),
    inventory: (): Inventory => ({ available: () => 0, reserve: () => false, commit: () => {} }),
    payments: (): PaymentGateway => ({ charge: async () => 'charge' }),
    notifier: (): Notifier => ({ orderPlaced: async () => {} }),
  })
  .verifyGraph() satisfies void;
