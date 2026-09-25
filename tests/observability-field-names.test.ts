import { expect, test } from 'bun:test';
import { DiBag, DiBagDisposalError, type LifecycleEvent } from '../src';

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

test('failures and events use the 0.5.0 field names and kinds', async () => {
  const { app, events } = scenario();
  const child = app.createChildContainer();
  await child.close();
  const error = await app.close().catch((reason: unknown) => reason);
  expect(error).toBeInstanceOf(DiBagDisposalError);
  expect((error as DiBagDisposalError).failures.map(failure => failure.bindingLabel)).toEqual(['Symbol(clock)']);
  expect(Object.keys((error as DiBagDisposalError).failures[0]!).sort()).toEqual(['acquisitionId', 'bindingId', 'bindingLabel', 'error']);
  expect(Object.keys(app.graphSnapshot()).sort()).toEqual(['bindings', 'containerId', 'contributions', 'observedEdges']);
  expect([...new Set(events.map(event => event.kind))].sort()).toEqual(['acquisition-ready', 'acquisition-started', 'container-close-failed', 'container-closed', 'container-closing', 'container-opened', 'disposal-completed', 'disposal-failed', 'disposal-started']);
  const opened = events.filter(event => event.kind === 'container-opened');
  expect(opened.map(event => Object.keys(event).sort())).toEqual([['containerId', 'kind'], ['containerId', 'kind', 'parentContainerId']]);
  const started = events.find(event => event.kind === 'acquisition-started')!;
  expect(Object.keys(started).sort()).toEqual(['acquisitionId', 'acquisitionMetadata', 'bindingId', 'bindingLabel', 'containerId', 'kind', 'lifetime', 'registrationMetadata']);
});
