import { DiBag } from 'di-bag';
import type { Catalog } from '../catalog/contract.js';
import type { Inventory } from '../inventory/contract.js';
import type { Notifier } from '../notifications/contract.js';
import type { Checkout, PaymentGateway } from './contract.js';

export const checkoutModule = DiBag.createBuilder()
  .withServices({
    orderIds: DiBag.withLifetime(() => {
      let last = 0;
      return { next: () => `order-${++last}` };
    }, 'root'),
    checkout: ({ catalog, inventory, payments, notifier, orderIds }: {
      catalog: Catalog;
      inventory: Inventory;
      payments: PaymentGateway;
      notifier: Notifier;
      orderIds: { next(): string };
    }): Checkout => ({
      async placeOrder(lines) {
        if (lines.length === 0) throw new Error('an order needs at least one line');
        let totalCents = 0;
        for (const { sku, quantity } of lines) {
          const product = catalog.find(sku);
          if (!product) throw new Error(`unknown sku: ${sku}`);
          if (!inventory.reserve(sku, quantity)) throw new Error(`insufficient stock: ${sku}`);
          totalCents += product.priceCents * quantity;
        }
        const chargeId = await payments.charge(totalCents);
        inventory.commit();
        const orderId = orderIds.next();
        await notifier.orderPlaced({ orderId, totalCents });
        return { orderId, totalCents, chargeId };
      },
    }),
  })
  .buildModule({ exportedServiceKeys: ['checkout'], moduleLabel: 'checkout' });
