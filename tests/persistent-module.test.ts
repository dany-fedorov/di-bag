import { expect, test } from 'bun:test';
import { DiBag } from '../src/node';
import { moduleGraph } from '../src/module';

// Count real native-map entry visits to catch a whole-table copy during one
// incremental update. The original iterator remains responsible for all values.
test('one module update does not revisit its existing registration table', () => {
  const registrations = Object.fromEntries(Array.from({ length: 1000 }, (_, i) => [`p${i}`, () => i]));
  const builder = DiBag.createModuleBuilder().register(registrations as { p0: () => number });
  const original = Map.prototype[Symbol.iterator];
  let visited = 0;
  Map.prototype[Symbol.iterator] = function* (): ReturnType<typeof original> {
    for (const entry of original.call(this)) { visited++; yield entry; }
    return undefined;
  };
  try {
    builder.register({ extra: () => 1 });
    expect(visited).toBeLessThan(10);
  } finally { Map.prototype[Symbol.iterator] = original; }
});

test('module updates preserve declaration positions, earlier builders and renamed lexical exports', async () => {
  const key = Symbol('same'), token = DiBag.token(key).of<number>();
  const groupKey = Symbol('group');
  const group = DiBag.token(groupKey).of<number>();
  const original = DiBag.createModuleBuilder().register({ zebra: () => 1, apple: () => 2 }).register(token, () => 3)
    .contribute(group, ({ zebra }: { zebra: number }) => zebra);
  const updated = original.replace('zebra', () => 4).alias('alias', 'apple').contribute(group, () => 5);
  const module = updated.buildModule(['zebra', 'apple', token, 'alias']).renameExport('zebra', 'renamed');
  const description = moduleGraph(module);
  expect([...description.bindings.values()].map(binding => binding.label)).toEqual(['zebra', 'apple', 'Symbol(same)', 'alias', 'contribution:Symbol(group)', 'contribution:Symbol(group)']);
  const earlier = DiBag.createBuilder().installModule(original.buildModule(['zebra', 'apple', token])).build();
  const later = DiBag.createBuilder().installModule(module).build();
  expect(earlier.resolve('zebra')).toBe(1);
  expect(earlier.resolveAll(group)).toEqual([1]);
  expect(later.resolve('renamed')).toBe(4);
  expect(later.resolve('alias')).toBe(2);
  expect(later.resolve(token)).toBe(3);
  expect(later.resolveAll(group)).toEqual([4, 5]);
  await earlier.close(); await later.close();
});
