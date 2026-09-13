import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { DiBag } from 'di-bag';
import { catalogModule } from '../../src/features/catalog/module.js';

const products = [
  { sku: 'tea', name: 'Green tea', priceCents: 450 },
  { sku: 'mug', name: 'Mug', priceCents: 1200 },
];
const data = (list: typeof products) => DiBag.withLifetime(() => ({ products: list }), 'root');
const base = DiBag.createBuilder().installModule(catalogModule).register({ catalogData: data([]) }).build();
after(() => base.close());

const shop = (list = products) => base.fork(['catalogData'], { catalogData: data(list) });

test('find returns the product for a SKU and undefined otherwise', async () => {
  const bag = shop();
  try {
    const catalog = bag.createScope().resolve('catalog');
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
    assert.deepEqual([...bag.createScope().resolve('catalog').list()], reversed);
  } finally {
    await bag.close();
  }
});

test('every scope resolves the same catalog', async () => {
  const bag = shop();
  try {
    assert.equal(bag.createScope().resolve('catalog'), bag.createScope().resolve('catalog'));
  } finally {
    await bag.close();
  }
});
