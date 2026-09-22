import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { DiBag } from 'di-bag';
import type { Catalog } from '../catalog/contract.js';
import type { StockLevels } from './contract.js';
import { inventoryModule } from './module.js';

const fixture = DiBag.createBuilder()
  .withInstalledModules([inventoryModule])
  .withServices({
    stockLevels: DiBag.withLifetime((): StockLevels => ({}), 'root'),
    catalog: DiBag.withLifetime((): Catalog => ({ find: () => undefined, list: () => [] }), 'root'),
  })
  .buildContainer();
after(() => fixture.close());

test('closing a scope releases its uncommitted reservations', async () => {
  const bag = fixture.fork(['stockLevels', 'catalog'], {
    stockLevels: DiBag.withLifetime((): StockLevels => ({ tea: 5 }), 'root'),
    catalog: DiBag.withLifetime((): Catalog => ({ find: sku => ({ sku, name: sku, priceCents: 1 }), list: () => [] }), 'root'),
  });
  try {
    const request = bag.createScope();
    assert.equal(request.resolve('inventory').reserve('tea', 2), true);
    const other = bag.createScope();
    assert.equal(other.resolve('inventory').available('tea'), 3);
    await request.close();
    assert.equal(other.resolve('inventory').available('tea'), 5);
  } finally {
    await bag.close();
  }
});
