import { expect, test } from 'bun:test';
import { DiBag } from '../src';
import { moduleGraph } from '../src/module';
import { BindingGraph } from '../src/runtime';

// Count real native-map entry visits to catch a whole-table copy during one
// incremental update. The original iterator remains responsible for all values.
test('one module update does not revisit its existing registration table', () => {
  const registrations = Object.fromEntries(Array.from({ length: 1000 }, (_, i) => [`p${i}`, () => i]));
  const builder = DiBag.createBuilder().withServices(registrations as { p0: () => number });
  const original = Map.prototype[Symbol.iterator];
  let visited = 0;
  Map.prototype[Symbol.iterator] = function* (): ReturnType<typeof original> {
    for (const entry of original.call(this)) { visited++; yield entry; }
    return undefined;
  };
  try {
    builder.withServices({ extra: () => 1 });
    expect(visited).toBeLessThan(10);
  } finally { Map.prototype[Symbol.iterator] = original; }
});

test('module updates preserve declaration positions, earlier builders and renamed lexical exports', async () => {
  const key = Symbol('same'), token = DiBag.token(key).of<number>();
  const groupKey = Symbol('group');
  const group = DiBag.token(groupKey).forCollectionOf<number>();
  const original = DiBag.createBuilder().withServices({ zebra: () => 1, apple: () => 2 }).withTokenService(token, () => 3)
    .withCollectionContribution({ collectionToken: group, provider: ({ zebra }: { zebra: number }) => zebra });
  const updated = original.withReplacedService('zebra', () => 4).withServiceAlias({ aliasKey: 'alias', targetServiceKey: 'apple' }).withCollectionContribution({ collectionToken: group, provider: () => 5 });
  const module = updated.buildModule({ exportedServiceKeys: ['zebra', 'apple', token, 'alias'] }).withRenamedExport({ currentExportKey: 'zebra', newExportKey: 'renamed' });
  const description = moduleGraph(module);
  expect([...description.bindings.values()].map(binding => binding.label)).toEqual(['zebra', 'apple', 'Symbol(same)', 'alias', 'contribution:Symbol(group)', 'contribution:Symbol(group)']);
  const earlier = DiBag.createBuilder().withInstalledModules([original.buildModule({ exportedServiceKeys: ['zebra', 'apple', token] })]).buildContainer();
  const later = DiBag.createBuilder().withInstalledModules([module]).buildContainer();
  expect(earlier.resolve('zebra')).toBe(1);
  expect(earlier.resolveCollection(group)).toEqual([1]);
  expect(later.resolve('renamed')).toBe(4);
  expect(later.resolve('alias')).toBe(2);
  expect(later.resolve(token)).toBe(3);
  expect(later.resolveCollection(group)).toEqual([4, 5]);
  await earlier.close(); await later.close();
});

test('module snapshots and installation retain positional token kinds until their binding is pruned', () => {
  const key = Symbol('module collection');
  const collection = DiBag.token(key).forCollectionOf<number>();
  const service = DiBag.token(key).of<number>();
  const module = DiBag.createBuilder()
    .withServices({ total: DiBag.fromFunction([collection], values => values.length) })
    .buildModule({ exportedServiceKeys: ['total'] });
  const description = moduleGraph(module);
  const graph = new BindingGraph().withInstallation(description);
  expect(() => graph.withTokenKind(key, 'single-service', 'register'))
    .toThrow('DI_BAG_WRONG_TOKEN_KIND');
  const replaced = graph.withPublicBinding('total', () => 0);
  expect(() => replaced.withTokenKind(key, 'single-service', 'register')).not.toThrow();
  expect(() => new BindingGraph(description)
    .withTokenKind(key, 'single-service', 'register')).toThrow('DI_BAG_WRONG_TOKEN_KIND');

  expect(() => DiBag.createBuilder().withInstalledModules([module]).withTokenService(service, () => 1))
    .toThrow('DI_BAG_WRONG_TOKEN_KIND');
});
