// tests/inspect-graph.test.ts
import { expect, test } from 'bun:test';
import { DiBag } from '../src/node';

test('inspectGraph lists public bindings in registration order without acquiring', async () => {
  let created = 0;
  const bag = DiBag.createBuilder()
    .withServices({
      config: DiBag.withLifetime(() => { created++; return { url: 'x' }; }, 'root'),
      db: DiBag.withLifetime(DiBag.withDisposal(({ config }: { config: { url: string } }) => { created++; return { url: config.url }; }, () => {}), 'root'),
    })
    .withServices({ handler: DiBag.withMetadata(({ db }: { db: { url: string } }) => () => db.url, { static: { 'app:kind': 'http' } }) })
    .withServiceAlias({ aliasKey: 'client', targetServiceKey: 'db' })
    .buildContainer();
  const graph = bag.inspectGraph();
  expect(created).toBe(0);
  expect(Object.isFrozen(graph)).toBe(true);
  expect(graph.bindings.map(binding => binding.keys)).toEqual([['config'], ['db'], ['handler'], ['client']]);
  const byKey = new Map(graph.bindings.map(binding => [binding.keys[0], binding]));
  expect(byKey.get('config')).toMatchObject({ label: 'config', lifetime: 'root', owned: false, acquisitionMode: 'auto', acquisitions: [] });
  expect(byKey.get('db')).toMatchObject({ lifetime: 'root', owned: true });
  expect(byKey.get('handler')!.registrationMetadata).toEqual({ 'app:kind': 'http' });
  expect(byKey.get('client')!.aliasTarget).toEqual({ bindingId: byKey.get('db')!.bindingId, label: 'db' });
  expect(graph.observedEdges).toEqual([]);
  expect(graph.contributions).toEqual([]);
  await bag.close();
});

test('inspectGraph reports observed edges, contributions, private module bindings, and attempts', async () => {
  const toolKey = Symbol('tool');
  const tool = DiBag.token(toolKey).of<string>();
  const toolsKey = Symbol('tools');
  const tools = DiBag.token(toolsKey).forCollectionOf<string>();
  const feature = DiBag.createBuilder()
    .withServices({ secret: () => 'hidden', exported: ({ secret }: { secret: string }) => secret.length })
    .withCollectionContribution({ collectionToken: tools, provider: () => 'a' })
    .buildModule({ exportedServiceKeys: ['exported'] });
  const bag = DiBag.createBuilder()
    .withInstalledModules([feature])
    .withCollectionContribution({ collectionToken: tools, provider: ({ exported }: { exported: number }) => `b${exported}` })
    .withServices({ reader: DiBag.fromFunction([tools, DiBag.optional(tool)], (values, _maybe) => values.length) })
    .buildContainer();

  const before = bag.inspectGraph();
  const labels = before.bindings.map(binding => binding.label);
  expect(labels).toContain('secret');
  expect(before.bindings.find(binding => binding.label === 'secret')!.keys).toEqual([]);
  expect(before.bindings.find(binding => binding.label === 'exported')!.keys).toEqual(['exported']);
  expect(before.contributions).toHaveLength(1);
  expect(before.contributions[0]!.token).toBe(toolsKey);
  expect(before.contributions[0]!.bindingIds).toHaveLength(2);
  expect(before.bindings.find(binding => binding.label === 'reader')!.tokenDependencies).toEqual([
    { key: toolsKey, kind: 'required' }, { key: toolKey, kind: 'optional' },
  ]);

  expect(bag.resolve('reader')).toBe(2);
  const after = bag.inspectGraph();
  const id = (label: string) => after.bindings.find(binding => binding.label === label)!.bindingId;
  const edges = after.observedEdges.map(edge => [after.bindings.find(b => b.bindingId === edge.from)!.label, after.bindings.find(b => b.bindingId === edge.to)!.label]);
  expect(edges).toContainEqual(['reader', `contribution:${String(toolsKey)}`]);
  expect(edges).toContainEqual(['exported', 'secret']);
  expect(after.bindings.find(binding => binding.label === 'exported')!.acquisitions.map(attempt => attempt.state)).toEqual(['ready']);
  // Symbols with equal descriptions stringify alike; compare edge identities pairwise.
  const pairs = after.observedEdges.map(edge => [edge.from, edge.to] as const);
  expect(pairs.filter((pair, index) => pairs.findIndex(other => other[0] === pair[0] && other[1] === pair[1]) !== index)).toEqual([]);
  expect(pairs).toHaveLength(4);
  void id;

  await bag.close();
  const closed = bag.inspectGraph();
  expect(closed.bindings.every(binding => binding.acquisitions.length === 0)).toBe(true);
  expect(closed.observedEdges).toEqual([]);
});

test('a child scope reports its own scope id and the family edges', async () => {
  const root = DiBag.createBuilder().withServices({ shared: DiBag.withLifetime(() => 1, 'root'), local: ({ shared }: { shared: number }) => shared + 1 }).buildContainer();
  const child = root.createScope();
  expect(child.inspectGraph().scopeId).not.toBe(root.inspectGraph().scopeId);
  expect(child.resolve('local')).toBe(2);
  expect(child.inspectGraph().observedEdges).toHaveLength(1);
  expect(root.inspectGraph().observedEdges).toHaveLength(1);
  await root.close();
});
