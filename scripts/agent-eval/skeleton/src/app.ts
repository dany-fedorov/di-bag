import { DiBag } from 'di-bag';
import type { CatalogData } from './features/catalog/contract.js';
import { catalogModule } from './features/catalog/module.js';
import type { PaymentGateway } from './features/checkout/contract.js';
import { checkoutModule } from './features/checkout/module.js';
import type { StockLevels } from './features/inventory/contract.js';
import { inventoryModule } from './features/inventory/module.js';
import type { MailConfig } from './features/notifications/contract.js';
import { notificationsModule } from './features/notifications/module.js';

export const composition = DiBag.createBuilder()
  .withInstalledModules([
    catalogModule,
    inventoryModule,
    checkoutModule,
    notificationsModule,
  ])
  .withServices({
    catalogData: DiBag.providerWithLifetime({ provider: (): CatalogData => ({
      products: [
        { sku: 'tea', name: 'Green tea', priceCents: 450 },
        { sku: 'mug', name: 'Mug', priceCents: 1200 },
      ],
    }), lifetime: 'singleton:one-per-container-tree' }),
    stockLevels: DiBag.providerWithLifetime({ provider: (): StockLevels => ({ tea: 40, mug: 10 }), lifetime: 'singleton:one-per-container-tree' }),
    payments: DiBag.providerWithLifetime({ provider: (): PaymentGateway => ({ charge: async amountCents => `charge-${amountCents}` }), lifetime: 'scoped:one-per-container' }),
    mailConfig: DiBag.providerWithLifetime({ provider: (): MailConfig => ({
      opsAddress: 'ops@example.com',
      connect: async () => ({ send: async mail => { console.log(mail.subject); }, close: async () => {} }),
    }), lifetime: 'singleton:one-per-container-tree' }),
  });
