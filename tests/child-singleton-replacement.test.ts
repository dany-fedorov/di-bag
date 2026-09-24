import { expect, test } from 'bun:test';
import { DiBag } from '../src';

test('scoped remains the default across child containers', async () => {
  let calls = 0;
  const root = DiBag.createBuilder().withServices({ value: () => ({ call: ++calls }) }).buildContainer();
  const child = root.createChildContainer();
  expect(child.resolve('value')).not.toBe(root.resolve('value'));
  expect(calls).toBe(2);
  await root.close();
});

test('a child rejects only an explicitly marked singleton', async () => {
  const root = DiBag.createBuilder().withServices({
    singleton: DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'singleton:one-per-container-tree' }),
    scoped: () => 2,
  }).buildContainer();
  expect(() => (root.createChildContainer as (...args: unknown[]) => unknown)(
    ['singleton'], { singleton: () => 3 },
  )).toThrow("cannot replace singleton service 'singleton'");
  const child = root.createChildContainer(['scoped'], { scoped: () => 4 });
  expect(child.resolve('scoped')).toBe(4);
  await root.close();
});

test('an independent container may replace an explicitly marked singleton', async () => {
  const root = DiBag.createBuilder().withServices({
    singleton: DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'singleton:one-per-container-tree' }),
  }).buildContainer();
  const independent = root.createIndependentContainer(['singleton'], { singleton: () => 2 });
  expect(independent.resolve('singleton')).toBe(2);
  await independent.close(); await root.close();
});

test('aliases follow explicit singleton targets while collection replacement remains allowed', async () => {
  const itemsKey = Symbol('items');
  const items = DiBag.createToken(itemsKey).forCollectionOf<number>();
  const root = DiBag.createBuilder()
    .withServices({
      target: DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'singleton:one-per-container-tree' }),
    })
    .withServiceAlias({ aliasKey: 'alias', targetServiceKey: 'target' })
    .withCollectionContribution({ collectionToken: items, provider: () => 1 })
    .buildContainer();
  expect(() => (root.createChildContainer as (...args: unknown[]) => unknown)(
    ['alias'], { alias: () => 2 },
  )).toThrow("cannot replace singleton service 'alias'");
  const child = root.createChildContainer([items], { [items.symbol]: () => [2] });
  expect(child.resolveCollection(items)).toEqual([2]);
  await child.close(); await root.close();
});
