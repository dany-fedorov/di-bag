import { DiBag } from 'di-bag/node';
import type { Clock, Invoicing } from './contract.js';
import { createStore, type InvoiceStore } from './store.js';

export const invoicingModule = DiBag.createBuilder()
  .register({
    store: createStore,
    invoicing: ({ store, clock }: { store: InvoiceStore; clock: Clock }): Invoicing => ({
      issue: (orderId, amountCents) => `${store.save(orderId, amountCents)}@${clock.now()}`,
    }),
  })
  .buildModule(['invoicing']);
