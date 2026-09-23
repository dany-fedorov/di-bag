import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { DiBag } from 'di-bag';
import type { CatalogData } from './contract.js';
import { catalogModule } from './module.js';

const fixture = DiBag.createBuilder()
  .withInstalledModules([catalogModule])
  .withServices({ catalogData: DiBag.providerWithLifetime({ provider: (): CatalogData => ({ products: [] }), lifetime: 'singleton:one-per-container-tree' }) })
  .buildContainer();
after(() => fixture.close());

test('finds products and shares one catalog across scopes', async () => {
  const bag = fixture.createIndependentContainer(['catalogData'], {
    catalogData: DiBag.providerWithLifetime({ provider: (): CatalogData => ({ products: [{ sku: 'tea', name: 'Tea', priceCents: 450 }] }), lifetime: 'singleton:one-per-container-tree' }),
  });
  try {
    const catalog = bag.createChildContainer().resolve('catalog');
    assert.equal(catalog.find('tea')?.priceCents, 450);
    assert.equal(bag.createChildContainer().resolve('catalog'), catalog);
  } finally {
    await bag.close();
  }
});
