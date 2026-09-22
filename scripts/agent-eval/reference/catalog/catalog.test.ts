import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { DiBag } from 'di-bag';
import type { CatalogData } from './contract.js';
import { catalogModule } from './module.js';

const fixture = DiBag.createBuilder()
  .withInstalledModules([catalogModule])
  .withServices({ catalogData: DiBag.withLifetime((): CatalogData => ({ products: [] }), 'root') })
  .buildContainer();
after(() => fixture.close());

test('finds products and shares one catalog across scopes', async () => {
  const bag = fixture.createIndependentContainer(['catalogData'], {
    catalogData: DiBag.withLifetime((): CatalogData => ({ products: [{ sku: 'tea', name: 'Tea', priceCents: 450 }] }), 'root'),
  });
  try {
    const catalog = bag.createChildContainer().resolve('catalog');
    assert.equal(catalog.find('tea')?.priceCents, 450);
    assert.equal(bag.createChildContainer().resolve('catalog'), catalog);
  } finally {
    await bag.close();
  }
});
