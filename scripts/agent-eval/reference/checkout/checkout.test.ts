import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { DiBag } from 'di-bag/node';
import type { Catalog } from '../catalog/contract.js';
import type { Inventory } from '../inventory/contract.js';
import type { Notifier } from '../notifications/contract.js';
import type { PaymentGateway } from './contract.js';
import { checkoutModule } from './module.js';

const unused = () => { throw new Error('supply a fixture'); };
const fixture = DiBag.createBuilder()
  .installModule(checkoutModule)
  .register({
    catalog: DiBag.withLifetime((): Catalog => ({ find: () => ({ sku: 'tea', name: 'Tea', priceCents: 450 }), list: () => [] }), 'root'),
    inventory: (): Inventory => ({ available: () => 0, reserve: () => true, commit: () => {} }),
    payments: (): PaymentGateway => ({ charge: unused }),
    notifier: (): Notifier => ({ orderPlaced: async () => {} }),
  })
  .build();
after(() => fixture.close());

test('a declined charge rejects the order without committing', async () => {
  let commits = 0;
  const bag = fixture.fork(['inventory', 'payments'], {
    inventory: (): Inventory => ({ available: () => 0, reserve: () => true, commit: () => { commits++; } }),
    payments: (): PaymentGateway => ({ charge: async () => { throw new Error('declined'); } }),
  });
  try {
    await assert.rejects(bag.createScope().resolve('checkout').placeOrder([{ sku: 'tea', quantity: 1 }]), /declined/);
    assert.equal(commits, 0);
  } finally {
    await bag.close();
  }
});
