import { DiBag } from 'di-bag';
import type { Catalog } from '../catalog/contract.js';
import type { Inventory } from '../inventory/contract.js';
import type { Notifier } from '../notifications/contract.js';
import type { PaymentGateway } from './contract.js';
import { checkoutModule } from './module.js';

DiBag.createBuilder()
  .withInstalledModules([checkoutModule])
  .withServices({
    catalog: DiBag.providerWithLifetime({ provider: (): Catalog => ({ find: () => undefined, list: () => [] }), lifetime: 'singleton:one-per-container-tree' }),
    inventory: (): Inventory => ({ available: () => 0, reserve: () => false, commit: () => {} }),
    payments: (): PaymentGateway => ({ charge: async () => 'charge' }),
    notifier: (): Notifier => ({ orderPlaced: async () => {} }),
  })
  .verifyGraphAtCompileTime() satisfies void;
