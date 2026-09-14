// checkoutModule exports `checkout`; the host registers `payments`, `catalog`
// comes from catalogModule, `inventory` from inventoryModule, and `notifier`
// from notificationsModule.
import type { Catalog } from '../catalog/contract.js';
import type { Inventory } from '../inventory/contract.js';
import type { Notifier } from '../notifications/contract.js';

export type OrderLine = { sku: string; quantity: number };
export type Receipt = { orderId: string; totalCents: number; chargeId: string };

/** Places the order of one request scope. */
export type Checkout = { placeOrder(lines: readonly OrderLine[]): Promise<Receipt> };

/** Registered by the host. `charge` resolves to a charge id. */
export type PaymentGateway = { charge(amountCents: number): Promise<string> };

export type CheckoutExports = { checkout: Checkout };
export type CheckoutRequirements = { catalog: Catalog; inventory: Inventory; payments: PaymentGateway; notifier: Notifier };
