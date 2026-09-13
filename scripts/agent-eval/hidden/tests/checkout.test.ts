import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { DiBag } from 'di-bag';
import { checkoutModule } from '../../src/features/checkout/module.js';

const products = [
  { sku: 'tea', name: 'Green tea', priceCents: 450 },
  { sku: 'mug', name: 'Mug', priceCents: 1200 },
];
const unused = () => { throw new Error('fixture not supplied'); };
const base = DiBag.createBuilder()
  .installModule(checkoutModule)
  .register({
    catalog: DiBag.withLifetime(() => ({ find: unused, list: unused }), 'root'),
    inventory: () => ({ available: unused, reserve: unused, commit: unused }),
    payments: () => ({ charge: unused }),
    notifier: () => ({ orderPlaced: unused }),
  })
  .build();
after(() => base.close());

function shop({ inStock = true, charge = async (cents: number) => `ch-${cents}` } = {}) {
  const log: string[] = [];
  const bag = base.fork(['catalog', 'inventory', 'payments', 'notifier'], {
    catalog: DiBag.withLifetime(() => ({ find: (sku: string) => products.find(product => product.sku === sku), list: () => products }), 'root'),
    inventory: () => ({
      available: () => 0,
      reserve: (sku: string, quantity: number) => { log.push(`reserve ${sku} ${quantity}`); return inStock; },
      commit: () => { log.push('commit'); },
    }),
    payments: () => ({ charge: async (cents: number) => { log.push(`charge ${cents}`); return charge(cents); } }),
    notifier: () => ({ orderPlaced: async (order: { orderId: string; totalCents: number }) => { log.push(`notify ${order.orderId} ${order.totalCents}`); } }),
  });
  return { bag, log, after: (prefix: string) => log.filter(entry => !entry.startsWith(prefix)) };
}

test('places an order: reserves, charges the total, commits, notifies, and returns the receipt', async () => {
  const { bag, log, after: others } = shop();
  try {
    const receipt = await bag.createScope().resolve('checkout').placeOrder([{ sku: 'tea', quantity: 2 }, { sku: 'mug', quantity: 1 }]);
    assert.equal(typeof receipt.orderId, 'string');
    assert.notEqual(receipt.orderId, '');
    assert.equal(receipt.totalCents, 2100);
    assert.equal(receipt.chargeId, 'ch-2100');
    assert.deepEqual(log.filter(entry => entry.startsWith('reserve')).sort(), ['reserve mug 1', 'reserve tea 2']);
    assert.deepEqual(others('reserve'), ['charge 2100', 'commit', `notify ${receipt.orderId} 2100`]);
  } finally {
    await bag.close();
  }
});

test('rejects an empty order without charging', async () => {
  const { bag, log } = shop();
  try {
    await assert.rejects(bag.createScope().resolve('checkout').placeOrder([]), Error);
    assert.deepEqual(log, []);
  } finally {
    await bag.close();
  }
});

test('rejects an unknown SKU without charging, committing, or notifying', async () => {
  const { bag, after: others } = shop();
  try {
    await assert.rejects(bag.createScope().resolve('checkout').placeOrder([{ sku: 'cake', quantity: 1 }]), Error);
    assert.deepEqual(others('reserve'), []);
  } finally {
    await bag.close();
  }
});

test('rejects when stock cannot be reserved without charging, committing, or notifying', async () => {
  const { bag, after: others } = shop({ inStock: false });
  try {
    await assert.rejects(bag.createScope().resolve('checkout').placeOrder([{ sku: 'tea', quantity: 1 }]), Error);
    assert.deepEqual(others('reserve'), []);
  } finally {
    await bag.close();
  }
});

test('a rejected charge rejects the order with that error and neither commits nor notifies', async () => {
  const declined = new Error('declined');
  const { bag, after: others } = shop({ charge: async () => { throw declined; } });
  try {
    await assert.rejects(bag.createScope().resolve('checkout').placeOrder([{ sku: 'tea', quantity: 1 }]), error => error === declined);
    assert.deepEqual(others('reserve'), ['charge 450']);
  } finally {
    await bag.close();
  }
});

test('order ids are unique across scopes', async () => {
  const { bag } = shop();
  try {
    const first = await bag.createScope().resolve('checkout').placeOrder([{ sku: 'tea', quantity: 1 }]);
    const second = await bag.createScope().resolve('checkout').placeOrder([{ sku: 'tea', quantity: 1 }]);
    assert.notEqual(first.orderId, second.orderId);
  } finally {
    await bag.close();
  }
});
