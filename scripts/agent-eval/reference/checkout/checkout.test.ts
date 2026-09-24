import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { DiBag } from 'di-bag';
import type { Catalog } from '../catalog/contract.js';
import type { Inventory } from '../inventory/contract.js';
import type { Notifier } from '../notifications/contract.js';
import type { PaymentGateway } from './contract.js';
import { checkoutModule } from './module.js';

const unused = () => { throw new Error('supply a fixture'); };
const fixture = DiBag.createBuilder()
  .withInstalledModules([checkoutModule])
  .withServices({
    catalog: DiBag.providerWithLifetime({ provider: (): Catalog => ({ find: () => ({ sku: 'tea', name: 'Tea', priceCents: 450 }), list: () => [] }), lifetime: 'singleton:one-per-container-tree' }),
    inventory: DiBag.providerWithLifetime({ provider: (): Inventory => ({ available: () => 0, reserve: () => true, commit: () => {} }), lifetime: 'scoped:one-per-container' }),
    payments: DiBag.providerWithLifetime({ provider: (): PaymentGateway => ({ charge: unused }), lifetime: 'scoped:one-per-container' }),
    notifier: DiBag.providerWithLifetime({ provider: (): Notifier => ({ orderPlaced: async () => {} }), lifetime: 'scoped:one-per-container' }),
  })
  .buildContainer();
after(() => fixture.close());

test('a declined charge rejects the order without committing', async () => {
  let commits = 0;
  const bag = fixture.createIndependentContainer(['inventory', 'payments'], {
    inventory: DiBag.providerWithLifetime({ provider: (): Inventory => ({ available: () => 0, reserve: () => true, commit: () => { commits++; } }), lifetime: 'scoped:one-per-container' }),
    payments: DiBag.providerWithLifetime({ provider: (): PaymentGateway => ({ charge: async () => { throw new Error('declined'); } }), lifetime: 'scoped:one-per-container' }),
  });
  try {
    await assert.rejects(bag.createChildContainer().resolve('checkout').placeOrder([{ sku: 'tea', quantity: 1 }]), /declined/);
    assert.equal(commits, 0);
  } finally {
    await bag.close();
  }
});
