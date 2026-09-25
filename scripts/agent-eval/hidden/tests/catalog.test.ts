import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { DiBag } from 'di-bag';
import { catalogModule } from '../../src/features/catalog/module.js';

const products = [
  { sku: 'tea', name: 'Green tea', priceCents: 450 },
  { sku: 'mug', name: 'Mug', priceCents: 1200 },
];
const data = (list: typeof products) => DiBag.providerWithLifetime({ provider: () => ({ products: list }), lifetime: 'singleton:one-per-container-tree' });
const base = DiBag.createBuilder()
  .withInstalledModules([catalogModule])
  .withServices({ catalogData: data([]) })
  .buildContainer();
after(() => base.close());

const shop = (list = products) => base.createIndependentContainer(['catalogData'], { catalogData: data(list) });

test('find returns the product for a SKU and undefined otherwise', async () => {
  const bag = shop();
  try {
    const catalog = bag.createChildContainer().resolve('catalog');
    assert.deepEqual(catalog.find('mug'), products[1]);
    assert.equal(catalog.find('cake'), undefined);
  } finally {
    await bag.close();
  }
});

test('list returns products in catalogData order', async () => {
  const reversed = [...products].reverse();
  const bag = shop(reversed);
  try {
    assert.deepEqual([...bag.createChildContainer().resolve('catalog').list()], reversed);
  } finally {
    await bag.close();
  }
});

test('every scope resolves the same catalog', async () => {
  const bag = shop();
  try {
    assert.equal(bag.createChildContainer().resolve('catalog'), bag.createChildContainer().resolve('catalog'));
  } finally {
    await bag.close();
  }
});
