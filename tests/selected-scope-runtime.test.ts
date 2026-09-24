import { expect, test } from 'bun:test';
import { isPromise } from 'node:util/types';
import { DiBag } from '../src';
import { BindingGraph, BagRuntime } from '../src/runtime';
import type { FactoryContext } from '../src/acquisition-context';
import { deferred } from './helpers';

const context = { isNativePromise: isPromise };

test('selected service borrows parent configuration and ownership while child config is overridden', async () => {
  const disposed: string[] = [];
  const graph = new BindingGraph().withPublicRegistrations({
    config: DiBag.providerWithLifetime({ provider: DiBag.providerWithDisposal({ provider: () => ({ name: 'parent' }), disposeService: value => { disposed.push(value.name); } }), lifetime: 'scoped:one-per-container' }),
    service: DiBag.providerWithLifetime({ provider: DiBag.providerWithDisposal({ provider: DiBag.providerWithRegistrationMetadata({ provider: (deps: { config: { name: string } }) => ({ config: deps.config }), registrationMetadata: { owner: 'service' } }), disposeService: () => { disposed.push('service'); } }), lifetime: 'scoped:one-per-container' }),
  });
  const parent = new BagRuntime(graph, context);
  const overridden = graph.withPublicBinding('config', DiBag.providerWithLifetime({ provider: DiBag.providerWithDisposal({ provider: () => ({ name: 'child' }), disposeService: value => { disposed.push(value.name); } }), lifetime: 'scoped:one-per-container' }));
  const child = parent.scope(overridden, [graph.publicBinding('service')]);
  expect(parent.inspect('service').acquisitions).toEqual([]);
  const service = child.resolve('service');
  expect(service).toBe(parent.resolve('service'));
  expect(service).toEqual({ config: { name: 'parent' } });
  expect(child.resolve('config')).toEqual({ name: 'child' });
  const snapshot = child.inspect('service');
  expect(snapshot.registrationMetadata).toEqual({ owner: 'service' });
  expect(snapshot.acquisitions).toEqual(parent.inspect('service').acquisitions);
  expect(snapshot.acquisitions).not.toBe(parent.inspect('service').acquisitions);
  await child.close();
  expect(disposed).toEqual(['child']);
  expect(parent.resolve('service')).toBe(service);
  await parent.close();
  expect(disposed).toEqual(['child', 'service', 'parent']);
});

test('scoped sharing selects the immediate parent and must be selected again by grandchildren', async () => {
  let next = 0;
  const graph = new BindingGraph().withPublicRegistrations({ service: DiBag.providerWithLifetime({ provider: () => ({ id: ++next }), lifetime: 'scoped:one-per-container' }) });
  const parent = new BagRuntime(graph, context);
  const child = parent.scope();
  const grandchild = child.scope(graph, [graph.publicBinding('service')]);
  expect(grandchild.resolve('service')).toBe(child.resolve('service'));
  expect(parent.resolve('service')).not.toBe(child.resolve('service'));
  const sharedChild = parent.scope(graph, [graph.publicBinding('service')]);
  expect(sharedChild.scope().resolve('service')).not.toBe(parent.resolve('service'));
  expect(sharedChild.scope(graph, [graph.publicBinding('service')]).resolve('service')).toBe(parent.resolve('service'));
  await parent.close();
});

test('child-defined roots anchor their graph while inherited roots construct in the original graph', async () => {
  const disposed: string[] = [];
  const root = (name: string) => DiBag.providerWithLifetime({ provider: DiBag.providerWithDisposal({ provider: (deps: { config: string }) => ({ name, config: deps.config }), disposeService: value => { disposed.push(value.name); } }), lifetime: 'singleton:one-per-container-tree', allowsScopedDependencies: true });
  const graph = new BindingGraph().withPublicRegistrations({ config: DiBag.providerWithLifetime({ provider: () => 'parent', lifetime: 'scoped:one-per-container' }), inherited: root('inherited'), replaced: root('old') });
  const parent = new BagRuntime(graph, context);
  const childGraph = graph.withPublicRegistrations({ config: DiBag.providerWithLifetime({ provider: () => 'child', lifetime: 'scoped:one-per-container' }), replaced: root('new') });
  const child = parent.scope(childGraph);
  const grandchild = child.scope(childGraph.withPublicBinding('config', DiBag.providerWithLifetime({ provider: () => 'grandchild', lifetime: 'scoped:one-per-container' })));
  const introduced = grandchild.resolve('replaced');
  expect(introduced).toEqual({ name: 'new', config: 'child' });
  expect(child.resolve('replaced')).toBe(introduced);
  expect(grandchild.inspect('replaced').acquisitions).toEqual(child.inspect('replaced').acquisitions);
  expect(parent.inspect('replaced').acquisitions).toEqual([]);
  const inherited = grandchild.resolve('inherited');
  expect(inherited).toEqual({ name: 'inherited', config: 'parent' });
  expect(parent.resolve('inherited')).toBe(inherited);
  expect(child.scope(childGraph, [childGraph.publicBinding('replaced')]).resolve('replaced')).toBe(introduced);
  await child.close();
  expect(disposed).toEqual(['new']);
  expect(parent.resolve('replaced')).toEqual({ name: 'old', config: 'parent' });
  await parent.close();
  expect(disposed).toEqual(['new', 'old', 'inherited']);
});

test('shared pending promises deduplicate and failed acquisitions retry at the owner', async () => {
  const gate = deferred<number>();
  let calls = 0;
  const graph = new BindingGraph().withPublicRegistrations({ service: DiBag.providerWithLifetime({ provider: () => ++calls === 1 ? gate.promise : Promise.resolve(42), lifetime: 'scoped:one-per-container' }) });
  const parent = new BagRuntime(graph, context);
  const child = parent.scope(graph, [graph.publicBinding('service')]);
  const sibling = parent.scope(graph, [graph.publicBinding('service')]);
  const pending = child.resolve('service');
  expect(pending).toBe(gate.promise);
  expect(sibling.resolve('service')).toBe(pending);
  expect(parent.resolve('service')).toBe(pending);
  const first = child.inspect('service').acquisitions[0]!.acquisitionId;
  gate.reject(new Error('retry'));
  await expect(gate.promise).rejects.toThrow('retry');
  const retry = sibling.resolve('service');
  expect(child.resolve('service')).toBe(retry);
  expect(parent.resolve('service')).toBe(retry);
  expect(await retry).toBe(42);
  expect(child.inspect('service').acquisitions[0]!.acquisitionId).not.toBe(first);
  expect(calls).toBe(2);
  await parent.close();
});

test('closing a borrower leaves the pending owner context and finalizer intact', async () => {
  const gate = deferred<void>();
  let ownerContext: FactoryContext | undefined;
  let finalized = 0;
  const graph = new BindingGraph().withPublicRegistrations({
    service: DiBag.providerWithLifetime({ provider: DiBag.providerWithDisposal({ provider: DiBag.createProvider(async (_deps: {}, factoryCtx) => { ownerContext = factoryCtx; await gate.promise; return 42; }, { factoryReceivesContext: true }), disposeService: () => { finalized++; } }), lifetime: 'scoped:one-per-container' }),
    local: DiBag.providerWithLifetime({ provider: DiBag.createProvider((_deps: {}, factoryCtx) => factoryCtx, { factoryReceivesContext: true }), lifetime: 'scoped:one-per-container' }),
  });
  const parent = new BagRuntime(graph, context);
  const child = parent.scope(graph, [graph.publicBinding('service')]);
  const pending = child.resolve('service');
  const local = child.resolve('local') as FactoryContext;
  await child.close('child');
  expect(local.abortSignal.aborted).toBe(true);
  expect(ownerContext?.abortSignal.aborted).toBe(false);
  expect(finalized).toBe(0);
  expect(parent.resolve('service')).toBe(pending);
  gate.resolve();
  expect(await pending).toBe(42);
  await parent.close('parent');
  expect(ownerContext?.abortSignal.reason).toBe('parent');
  expect(finalized).toBe(1);
});

test('pending child sources discover shared parent dependencies during tree close', async () => {
  const gate = deferred<void>();
  const events: string[] = [];
  let lateContext: FactoryContext | undefined;
  const graph = new BindingGraph().withPublicRegistrations({
    service: DiBag.providerWithLifetime({ provider: DiBag.providerWithDisposal({ provider: DiBag.createProvider((_deps: {}, factoryCtx) => { lateContext = factoryCtx; return 42; }, { factoryReceivesContext: true }), disposeService: () => { events.push('service'); } }), lifetime: 'scoped:one-per-container' }),
    context: DiBag.providerWithLifetime({ provider: DiBag.createProvider((_deps: {}, factoryCtx) => factoryCtx, { factoryReceivesContext: true }), lifetime: 'scoped:one-per-container' }),
    consumer: DiBag.providerWithLifetime({ provider: DiBag.providerWithDisposal({ provider: async (deps: { service: number }) => { await gate.promise; return deps.service; }, disposeService: () => { events.push('consumer'); } }), lifetime: 'scoped:one-per-container' }),
  });
  const parent = new BagRuntime(graph, context);
  const ownerContext = parent.resolve('context') as FactoryContext;
  const child = parent.scope(graph, [graph.publicBinding('service')]);
  const pending = child.resolve('consumer');
  const closing = parent.close('tree');
  await Promise.resolve();
  expect(() => child.resolve('service')).toThrow(/clos/);
  gate.resolve();
  expect(await pending).toBe(42);
  await closing;
  expect(lateContext?.abortSignal).toBe(ownerContext.abortSignal);
  expect(lateContext?.abortSignal.reason).toBe('tree');
  expect(events).toEqual(['consumer', 'service']);
});

test('strict child roots reject shared scoped dependencies before reading a cached owner', async () => {
  let calls = 0;
  const graph = new BindingGraph().withPublicRegistrations({ service: DiBag.providerWithLifetime({ provider: () => ++calls, lifetime: 'scoped:one-per-container' }), root: DiBag.providerWithLifetime({ provider: () => 0, lifetime: 'scoped:one-per-container' }) });
  const parent = new BagRuntime(graph, context);
  parent.resolve('service');
  const childGraph = graph.withPublicBinding('root', DiBag.providerWithLifetime({ provider: (deps: { service: number }) => deps.service, lifetime: 'singleton:one-per-container-tree' }));
  const child = parent.scope(childGraph, [graph.publicBinding('service')]);
  expect(() => child.resolve('root')).toThrow('root lifetime cannot capture scoped dependency');
  expect(calls).toBe(1);
  await parent.close();
});

test('shared dependency edges detect cycles through retained owner proxies', async () => {
  type Reader = { read(): Reader };
  let readBack!: () => unknown;
  const cyclicGraph = new BindingGraph().withPublicRegistrations({
    owner: DiBag.providerWithLifetime({ provider: (deps: { consumer: Reader }) => { readBack = () => deps.consumer; return { read: () => deps.consumer }; }, lifetime: 'scoped:one-per-container' }),
    consumer: DiBag.providerWithLifetime({ provider: (deps: { owner: Reader }) => ({ read: () => deps.owner }), lifetime: 'scoped:one-per-container' }),
  });
  const cyclicParent = new BagRuntime(cyclicGraph, context);
  const cyclicChild = cyclicParent.scope(cyclicGraph, [cyclicGraph.publicBinding('owner'), cyclicGraph.publicBinding('consumer')]);
  const cyclicConsumer = cyclicChild.resolve('consumer') as Reader;
  expect(cyclicConsumer).toBe(cyclicParent.resolve('consumer') as Reader);
  cyclicConsumer.read();
  expect(readBack).toThrow('cycle');
  await cyclicParent.close();
});

test('shared module bindings preserve lexical private dependencies despite child public replacements', async () => {
  const hidden = Symbol('hidden');
  const service = Symbol('service');
  const graph = new BindingGraph({
    bindings: new Map([
      [hidden, { id: hidden, label: 'module.hidden', registration: DiBag.providerWithLifetime({ provider: () => ({ name: 'private' }), lifetime: 'scoped:one-per-container' }), localNames: new Map() }],
      [service, { id: service, label: 'module.service', registration: DiBag.providerWithLifetime({ provider: (deps: { hidden: object; config: string }) => ({ hidden: deps.hidden, config: deps.config }), lifetime: 'scoped:one-per-container' }), localNames: new Map([['hidden', { kind: 'private' as const, id: hidden }]]) }],
    ]),
    publicSlots: new Map([['service', service]]),
  }).withPublicRegistrations({ hidden: DiBag.providerWithLifetime({ provider: () => ({ name: 'public' }), lifetime: 'scoped:one-per-container' }), config: DiBag.providerWithLifetime({ provider: () => 'parent', lifetime: 'scoped:one-per-container' }) });
  const parent = new BagRuntime(graph, context);
  const child = parent.scope(graph.withPublicRegistrations({ hidden: DiBag.providerWithLifetime({ provider: () => ({ name: 'child' }), lifetime: 'scoped:one-per-container' }), config: DiBag.providerWithLifetime({ provider: () => 'child', lifetime: 'scoped:one-per-container' }) }), [service]);
  expect(child.resolve('service')).toEqual({ hidden: { name: 'private' }, config: 'parent' });
  expect(child.resolve('service')).toBe(parent.resolve('service'));
  expect(child.resolve('hidden')).toEqual({ name: 'child' });
  await parent.close();
});

test('synchronous shared owner reentry detects a cycle across acquisition owners', async () => {
  let reenter!: () => unknown;
  let ownerCalls = 0;
  let consumerCalls = 0;
  const graph = new BindingGraph().withPublicRegistrations({
    owner: DiBag.providerWithLifetime({ provider: () => { ownerCalls++; return reenter(); }, lifetime: 'scoped:one-per-container' }),
    consumer: DiBag.providerWithLifetime({ provider: (deps: { owner: unknown }) => { consumerCalls++; return deps.owner; }, lifetime: 'scoped:one-per-container' }),
  });
  const parent = new BagRuntime(graph, context);
  const child = parent.scope(graph, [graph.publicBinding('owner')]);
  reenter = () => child.resolve('consumer');
  expect(() => child.resolve('owner')).toThrow('cycle');
  expect(ownerCalls).toBe(1);
  expect(consumerCalls).toBe(1);
  expect(parent.inspect('owner').acquisitions).toEqual([]);
  expect(child.inspect('consumer').acquisitions).toEqual([]);
  await parent.close();
});

for (const failed of [false, true]) {
  test(`a ${failed ? 'failed' : 'ready'} projection retains source permission for late shared reads`, async () => {
    const gate = deferred<void>();
    const events: string[] = [];
    const graph = new BindingGraph().withPublicRegistrations({
      owner: DiBag.providerWithLifetime({ provider: DiBag.providerWithDisposal({ provider: () => 42, disposeService: () => { events.push('owner'); } }), lifetime: 'scoped:one-per-container' }),
      consumer: DiBag.providerWithLifetime({ provider: DiBag.providerWithTransformedService({ provider: DiBag.providerWithDisposal({ provider: async (deps: { owner: number }) => { await gate.promise; return deps.owner; }, disposeService: () => { events.push('consumer'); } }), transformService: () => {
        if (failed) throw new Error('projection');
        return 7;
      }, callbackReceives: 'exposed-service' }), lifetime: 'scoped:one-per-container' }),
    });
    const parent = new BagRuntime(graph, context);
    const child = parent.scope(graph, [graph.publicBinding('owner')]);
    if (failed) expect(() => child.resolve('consumer')).toThrow('projection');
    else expect(child.resolve('consumer')).toBe(7);
    const closing = parent.close();
    gate.resolve();
    await closing;
    expect(events).toEqual(['consumer', 'owner']);
  });
}

test('completed and retired child proxies cannot borrow another source closing permission for shared reads', async () => {
  const gate = deferred<number>();
  let first = true;
  let stale!: () => number;
  let ownerCalls = 0;
  const graph = new BindingGraph().withPublicRegistrations({
    owner: DiBag.providerWithLifetime({ provider: () => { ownerCalls++; return 42; }, lifetime: 'scoped:one-per-container' }),
    reader: DiBag.providerWithLifetime({ provider: (deps: { owner: number }) => () => deps.owner, lifetime: 'scoped:one-per-container' }),
    retry: DiBag.providerWithLifetime({ provider: (deps: { owner: number }) => {
      if (first) { first = false; stale = () => deps.owner; throw new Error('failed'); }
      return gate.promise;
    }, lifetime: 'scoped:one-per-container' }),
  });
  const parent = new BagRuntime(graph, context);
  const child = parent.scope(graph, [graph.publicBinding('owner')]);
  const read = child.resolve('reader') as () => number;
  expect(() => child.resolve('retry')).toThrow('failed');
  child.resolve('retry');
  const closing = parent.close();
  expect(read).toThrow('bag is closing');
  expect(stale).toThrow('bag is closing');
  expect(ownerCalls).toBe(0);
  gate.resolve(1);
  await closing;
  expect(stale).toThrow('bag is closed');
});
