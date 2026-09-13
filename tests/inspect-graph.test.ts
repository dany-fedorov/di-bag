// tests/inspect-graph.test.ts
import { expect, test } from 'bun:test';
import { DiBag } from '../src/node';

test('inspectGraph lists public bindings in registration order without acquiring', async () => {
  let created = 0;
  const bag = DiBag.createBuilder()
    .register({
      config: DiBag.withLifetime(() => { created++; return { url: 'x' }; }, 'root'),
      db: DiBag.withLifetime(DiBag.withDisposal(({ config }: { config: { url: string } }) => { created++; return { url: config.url }; }, () => {}), 'root'),
    })
    .register({ handler: DiBag.withMetadata(({ db }: { db: { url: string } }) => () => db.url, { static: { 'app:kind': 'http' } }) })
    .alias('client', 'db')
    .build();
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
