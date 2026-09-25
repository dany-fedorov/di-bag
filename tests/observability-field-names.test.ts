import { expect, test } from 'bun:test';
import { DiBag, type LifecycleEvent } from '../src';

// Task 11 reuses this scenario to inspect lifecycle events from the same acquisitions.
export function scenario() {
  const events: LifecycleEvent[] = [];
  const clockKey = Symbol('clock');
  const clock = DiBag.createToken(clockKey).forService<{ now(): number }>();
  const pluginsKey = Symbol('plugins');
  const plugins = DiBag.createToken(pluginsKey).forCollectionOf<string>();
  const app = DiBag.withConfiguration({ lifecycleObservers: [{ onLifecycleEvent: event => { events.push(event); }, onObserverFailure: () => {} }] }).createBuilder()
    .withTokenService(clock, DiBag.providerWithDisposal({ provider: () => ({ now: () => 0 }), disposeService: () => { throw new Error('boom'); } }))
    .withServices({
      reader: DiBag.providerWithAcquisitionMetadata({
        provider: DiBag.createProviderFromFunction({ dependencies: [clock], factoryFunction: (dependency: { now(): number }) => dependency.now() }),
        describeAcquisition: () => ({ tag: 1 }),
        callbackReceives: 'exposed-service',
      }),
    })
    .withServiceAlias({ aliasKey: 'alias', targetServiceKey: 'reader' })
    .withCollectionContribution({ collectionToken: plugins, provider: () => 'a' })
    .buildContainer();
  app.resolve('reader');
  return { app, events, clockKey, pluginsKey };
}

test('snapshots expose descriptive field names without retired aliases', async () => {
  const { app, clockKey, pluginsKey } = scenario();
  const graph = app.graphSnapshot();
  const reader = graph.bindings.find(binding => binding.bindingLabel === 'reader')!;
  const clockBinding = graph.bindings.find(binding => binding.serviceKeys.includes(clockKey))!;
  expect(reader).toMatchObject({ bindingLabel: 'reader', serviceKeys: ['reader'], isOwnedByContainer: false, tokenDependencies: [{ tokenSymbol: clockKey, dependencyKind: 'required' }] });
  for (const retired of ['label', 'keys', 'owned']) expect(reader).not.toHaveProperty(retired);
  expect(clockBinding.isOwnedByContainer).toBe(true);
  expect(Object.keys(reader.tokenDependencies[0]!).sort()).toEqual(['dependencyKind', 'tokenSymbol']);
  expect(graph.contributions.map(item => Object.keys(item).sort())).toEqual([['bindingIds', 'collectionTokenSymbol']]);
  expect(graph.contributions[0]!.collectionTokenSymbol).toBe(pluginsKey);
  expect(graph.observedEdges).toEqual([{ consumerBindingId: reader.bindingId, dependencyBindingId: clockBinding.bindingId }]);
  expect(app.serviceSnapshot('alias').aliasTarget).toEqual({ bindingId: reader.bindingId, bindingLabel: 'reader' });
  expect(app.serviceSnapshot('reader').acquisitions[0]!.acquisitionMetadata).toEqual([{ isPresent: true, value: { tag: 1 } }]);
  await app.close().catch(() => {});
});
