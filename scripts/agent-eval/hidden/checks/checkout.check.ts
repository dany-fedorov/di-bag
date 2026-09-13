// The module installs with fixtures for exactly its contract's requirements and exports its contract.
import { DiBag } from 'di-bag/node';
import type { Catalog } from '../../src/features/catalog/contract.js';
import type { Checkout, PaymentGateway } from '../../src/features/checkout/contract.js';
import { checkoutModule } from '../../src/features/checkout/module.js';
import type { Inventory } from '../../src/features/inventory/contract.js';
import type { Notifier } from '../../src/features/notifications/contract.js';

const builder = DiBag.createBuilder()
  .installModule(checkoutModule)
  .register({
    catalog: DiBag.withLifetime((): Catalog => ({ find: () => undefined, list: () => [] }), 'root'),
    inventory: (): Inventory => ({ available: () => 0, reserve: () => false, commit: () => {} }),
    payments: (): PaymentGateway => ({ charge: async () => 'charge' }),
    notifier: (): Notifier => ({ orderPlaced: async () => {} }),
  });

builder.verifyGraph() satisfies void;
export const exported = (): Checkout => builder.build().resolve('checkout');
