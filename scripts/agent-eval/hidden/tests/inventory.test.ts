import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { DiBag } from 'di-bag/node';
import { inventoryModule } from '../../src/features/inventory/module.js';

const catalogOf = (skus: string[]) => DiBag.withLifetime(() => ({
  find: (sku: string) => skus.includes(sku) ? { sku, name: sku, priceCents: 100 } : undefined,
  list: () => skus.map(sku => ({ sku, name: sku, priceCents: 100 })),
}), 'root');
const stock = (levels: Record<string, number>) => DiBag.withLifetime(() => levels, 'root');
const base = DiBag.createBuilder()
  .installModule(inventoryModule)
  .register({ stockLevels: stock({}), catalog: catalogOf([]) })
  .build();
after(() => base.close());

const shop = (levels: Record<string, number>, skus: string[]) =>
  base.fork(['stockLevels', 'catalog'], { stockLevels: stock(levels), catalog: catalogOf(skus) });

test('reservations count across scopes and are released when an uncommitted scope closes', async () => {
  const bag = shop({ tea: 5 }, ['tea']);
  try {
    const first = bag.createScope();
    const second = bag.createScope();
    assert.equal(first.resolve('inventory').reserve('tea', 2), true);
    assert.equal(second.resolve('inventory').available('tea'), 3);
    await first.close();
    assert.equal(second.resolve('inventory').available('tea'), 5);
  } finally {
    await bag.close();
  }
});

test('committed reservations stay sold after the scope closes', async () => {
  const bag = shop({ tea: 5 }, ['tea']);
  try {
    const request = bag.createScope();
    const inventory = request.resolve('inventory');
    assert.equal(inventory.reserve('tea', 2), true);
    inventory.commit();
    await request.close();
    assert.equal(bag.createScope().resolve('inventory').available('tea'), 3);
  } finally {
    await bag.close();
  }
});

test('reserve refuses short stock and SKUs outside the catalog without reserving', async () => {
  const bag = shop({ tea: 2, mug: 3 }, ['tea']);
  try {
    const inventory = bag.createScope().resolve('inventory');
    assert.equal(inventory.reserve('tea', 3), false);
    assert.equal(inventory.available('tea'), 2);
    assert.equal(inventory.reserve('mug', 1), false);
    assert.equal(inventory.available('mug'), 3);
    assert.equal(inventory.reserve('cake', 1), false);
    assert.equal(inventory.available('cake'), 0);
  } finally {
    await bag.close();
  }
});

test('each scope resolves its own inventory', async () => {
  const bag = shop({ tea: 5 }, ['tea']);
  try {
    assert.notEqual(bag.createScope().resolve('inventory'), bag.createScope().resolve('inventory'));
  } finally {
    await bag.close();
  }
});
