import { expect, test } from 'bun:test';
import { DiBag, DiBagDisposalError } from '../src';
import { deferred } from './helpers';

test('a projected service does not replace its source disposer argument', async () => {
  const raw = { id: 'connection' };
  const events: string[] = [];
  const source = DiBag.providerWithDisposal({ provider: () => raw, disposeService: value => {
    expect(value).toBe(raw); events.push('raw');
  } });
  const client = DiBag.providerWithDisposal({ provider: DiBag.providerWithTransformedService({ provider: source, transformService: connection => ({ connection }), callbackReceives: 'exposed-service' }), disposeService: value => { expect(value.connection).toBe(raw); events.push('client'); } });
  const bag = DiBag.createBuilder().withServices({ client }).buildContainer();
  expect(bag.resolve('client').connection).toBe(raw);
  await bag.close();
  expect(events).toEqual(['client', 'raw']);
});

test('an ownership operation on a metadata provider retains earlier ownership', async () => {
  const raw = { id: 'same' };
  const events: string[] = [];
  const first = DiBag.providerWithDisposal({ provider: () => raw, disposeService: value => { expect(value).toBe(raw); events.push('first'); } });
  const second = DiBag.providerWithDisposal({ provider: DiBag.providerWithRegistrationMetadata({ provider: first, registrationMetadata: { owner: 'team' } }), disposeService: value => {
    expect(value).toBe(raw); events.push('second');
  } });
  const bag = DiBag.createBuilder().withServices({ second }).buildContainer();
  expect(bag.resolve('second')).toBe(raw);
  await bag.close();
  expect(events).toEqual(['second', 'first']);
});

test('direct transformService receives and returns exact Promise identities', async () => {
  const source = Promise.resolve({ id: 'raw' });
  const projected = Promise.resolve({ id: 'client' });
  let calls = 0;
  const bag = DiBag.createBuilder().withServices({ service: DiBag.providerWithTransformedService({ provider: () => { calls++; return source; }, transformService: value => {
    expect(value).toBe(source); return projected;
  }, callbackReceives: 'exposed-service' }) }).buildContainer();
  expect(bag.resolve('service')).toBe(projected);
  expect(bag.resolve('service')).toBe(projected);
  expect(calls).toBe(1);
  await bag.close();
});

test('awaited transformService rejects source and projector throws with their original values', async () => {
  const sourceCause = { error: 'source' };
  const projectCause = { error: 'project' };
  const bag = DiBag.createBuilder().withServices({
    source: DiBag.providerWithTransformedService({ provider: () => { throw sourceCause; }, transformService: value => value, callbackReceives: 'fulfilled-value' }),
    project: DiBag.providerWithTransformedService({ provider: () => 1, transformService: () => { throw projectCause; }, callbackReceives: 'fulfilled-value' }),
  }).buildContainer();
  await expect(bag.resolve('source')).rejects.toBe(sourceCause);
  await expect(bag.resolve('project')).rejects.toBe(projectCause);
  await bag.close();
});

test('awaited transformService awaits recursive projector thenables and source fulfillment', async () => {
  const nested: PromiseLike<PromiseLike<number>> = {
    then(accept) { return Promise.resolve(accept?.(Promise.resolve(42))) as never; },
  };
  const bag = DiBag.createBuilder().withServices({ service: DiBag.providerWithTransformedService({ provider: () => Promise.resolve('raw'), transformService: value => {
    expect(value).toBe('raw'); return nested;
  }, callbackReceives: 'fulfilled-value' }) }).buildContainer();
  await expect(bag.resolve('service')).resolves.toBe(42);
  await bag.close();
});

test('a failed sync projection releases late source ownership', async () => {
  const gate = deferred<{ id: string }>();
  const cause = new Error('project');
  const events: string[] = [];
  const raw = DiBag.providerWithDisposal({ provider: () => gate.promise, disposeService: value => { events.push(value.id); } });
  const projected = DiBag.providerWithTransformedService({ provider: raw, transformService: () => { throw cause; }, callbackReceives: 'exposed-service' });
  const bag = DiBag.createBuilder().withServices({ projected }).buildContainer();
  expect(() => bag.resolve('projected')).toThrow(cause);
  const closing = bag.close();
  gate.resolve({ id: 'released' });
  await closing;
  expect(events).toEqual(['released']);
});

test('a synchronous status projection stays cached after its raw Promise rejects', async () => {
  const gate = deferred<number>();
  let calls = 0;
  const bag = DiBag.createBuilder().withServices({ service: DiBag.providerWithTransformedService({ provider: () => { calls++; return gate.promise; }, transformService: promise => ({ promise }), callbackReceives: 'exposed-service' }) }).buildContainer();
  const status = bag.resolve('service');
  gate.reject('raw failure');
  await gate.promise.catch(() => {});
  expect(bag.resolve('service')).toBe(status);
  expect(status.promise).toBe(gate.promise);
  expect(bag.serviceSnapshot('service').acquisitions[0]?.state).toBe('ready');
  expect(calls).toBe(1);
  await bag.close();
});

test('ready outer ownership closes before a raw stage accepted later', async () => {
  const gate = deferred<number>();
  const events: string[] = [];
  const source = DiBag.providerWithDisposal({ provider: () => gate.promise, disposeService: () => { events.push('raw'); } });
  const outer = DiBag.providerWithDisposal({ provider: DiBag.providerWithTransformedService({ provider: source, transformService: promise => ({ promise }), callbackReceives: 'exposed-service' }), disposeService: () => { events.push('outer'); } });
  const bag = DiBag.createBuilder().withServices({ outer }).buildContainer();
  bag.resolve('outer');
  const closing = bag.close();
  gate.resolve(42);
  await closing;
  expect(events).toEqual(['outer', 'raw']);
});

test('failed projections clean only their stages and preserve cached dependencies', async () => {
  const events: string[] = [];
  const cause = new Error('projection');
  const dependency = { id: 'dependency' };
  const source = DiBag.providerWithDisposal({ provider: ({ dep }: { dep: typeof dependency }) => ({ dep }), disposeService: () => { events.push('source'); } });
  const bag = DiBag.createBuilder().withServices({
    dep: DiBag.providerWithDisposal({ provider: () => dependency, disposeService: () => { events.push('dep'); } }),
    failed: DiBag.providerWithTransformedService({ provider: source, transformService: () => { throw cause; }, callbackReceives: 'exposed-service' }),
  }).buildContainer();
  expect(() => bag.resolve('failed')).toThrow(cause);
  expect(events).toEqual(['source']);
  expect(bag.resolve('dep')).toBe(dependency);
  await bag.close();
  expect(events).toEqual(['source', 'dep']);
});

test('sync failure starts asynchronous cleanup without waiting and close drains it', async () => {
  const gate = deferred<void>();
  const started = deferred<void>();
  const cause = new Error('projection');
  const source = DiBag.providerWithDisposal({ provider: () => 1, disposeService: async () => { started.resolve(); await gate.promise; } });
  const bag = DiBag.createBuilder().withServices({ failed: DiBag.providerWithTransformedService({ provider: source, transformService: () => { throw cause; }, callbackReceives: 'exposed-service' }) }).buildContainer();
  expect(() => bag.resolve('failed')).toThrow(cause);
  await started.promise;
  let closed = false;
  const closing = bag.close().then(() => { closed = true; });
  await Promise.resolve();
  expect(closed).toBe(false);
  gate.resolve();
  await closing;
  expect(closed).toBe(true);
});

test('late old ownership cannot evict or dispose a successful retry', async () => {
  const old = deferred<number>();
  let count = 0;
  const events: number[] = [];
  const source = DiBag.providerWithDisposal({ provider: () => ++count === 1 ? old.promise : Promise.resolve(2), disposeService: value => { events.push(value); } });
  let projections = 0;
  const bag = DiBag.createBuilder().withServices({ service: DiBag.providerWithTransformedService({ provider: source, transformService: promise => {
    if (++projections === 1) throw new Error('retry');
    return { promise };
  }, callbackReceives: 'exposed-service' }) }).buildContainer();
  expect(() => bag.resolve('service')).toThrow('retry');
  const success = bag.resolve('service');
  old.resolve(1);
  await old.promise;
  await Promise.resolve();
  expect(bag.resolve('service')).toBe(success);
  expect(count).toBe(2);
  await bag.close();
  expect(events).toEqual([1, 2]);
});

test('retired cleanup errors keep invocation order and original attempt identities', async () => {
  const a = deferred<void>();
  const b = deferred<void>();
  const starts: string[] = [];
  const causeB = new Error('B');
  const ids: symbol[] = [];
  const bag = DiBag.createBuilder().withServices({ service: DiBag.providerWithTransformedService({ provider: DiBag.providerWithDisposal({ provider: () => {
    ids.push(bag.serviceSnapshot('service').acquisitions.at(-1)!.acquisitionId);
    return ids.length === 1 ? 'A' : 'B';
  }, disposeService: value => { starts.push(value); return value === 'A' ? a.promise : b.promise; } }), transformService: () => { throw new Error('project'); }, callbackReceives: 'exposed-service' }) }).buildContainer();
  expect(() => bag.resolve('service')).toThrow('project');
  expect(() => bag.resolve('service')).toThrow('project');
  expect(starts).toEqual(['A', 'B']);
  b.reject(causeB);
  await b.promise.catch(() => {});
  a.reject(undefined);
  const error = await bag.close().catch(error => error);
  expect(error).toBeInstanceOf(DiBagDisposalError);
  expect(error.errors).toEqual([undefined, causeB]);
  expect(error.failures.map((failure: { acquisitionId: symbol }) => failure.acquisitionId)).toEqual(ids);
  expect(error.failures.map((failure: object) => Reflect.ownKeys(failure))).toEqual([
    ['acquisitionId', 'bindingId', 'bindingLabel', 'error'], ['acquisitionId', 'bindingId', 'bindingLabel', 'error'],
  ]);
});

test('a pending source can read dependencies in close after an outer projection is ready', async () => {
  const gate = deferred<void>();
  const events: string[] = [];
  const source = DiBag.providerWithDisposal({ provider: async (deps: { dependency: number }) => {
    await gate.promise; return deps.dependency;
  }, disposeService: () => { events.push('source'); } });
  const bag = DiBag.createBuilder().withServices({
    service: DiBag.providerWithTransformedService({ provider: source, transformService: promise => ({ promise }), callbackReceives: 'exposed-service' }),
    dependency: DiBag.providerWithDisposal({ provider: () => 42, disposeService: () => { events.push('dependency'); } }),
  }).buildContainer();
  const service = bag.resolve('service');
  const closing = bag.close();
  gate.resolve();
  await expect(service.promise).resolves.toBe(42);
  await closing;
  expect(events).toEqual(['source', 'dependency']);
});

test('a pending source can finish dependencies after its outer projection failed', async () => {
  const gate = deferred<void>();
  const events: string[] = [];
  const bag = DiBag.createBuilder().withServices({
    service: DiBag.providerWithTransformedService({ provider: DiBag.providerWithDisposal({ provider: async (deps: { dependency: number }) => {
      await gate.promise; return deps.dependency;
    }, disposeService: value => { events.push(`source:${value}`); } }), transformService: () => { throw new Error('projection'); }, callbackReceives: 'exposed-service' }),
    dependency: DiBag.providerWithDisposal({ provider: () => 42, disposeService: () => { events.push('dependency'); } }),
  }).buildContainer();
  expect(() => bag.resolve('service')).toThrow('projection');
  const closing = bag.close();
  gate.resolve();
  await closing;
  expect(events).toEqual(['source:42', 'dependency']);
});

test('completed source proxies cannot borrow a pending projection or retry permission', async () => {
  const projectionGate = deferred<number>();
  const sourceGate = deferred<number>();
  let escaped!: { dependency: number };
  let count = 0;
  const source = (deps: { dependency: number }) => {
    if (++count === 1) { escaped = deps; return 1; }
    return sourceGate.promise;
  };
  let projected = 0;
  const bag = DiBag.createBuilder().withServices({
    service: DiBag.providerWithTransformedService({ provider: source, transformService: () => { if (++projected === 1) throw new Error('retry'); return projectionGate.promise; }, callbackReceives: 'exposed-service' }),
    dependency: () => 42,
  }).buildContainer();
  expect(() => bag.resolve('service')).toThrow('retry');
  bag.resolve('service');
  const closing = bag.close();
  expect(() => escaped.dependency).toThrow('container is closing');
  projectionGate.resolve(2);
  sourceGate.resolve(2);
  await closing;
});

test('mapped dependencies still reject genuine acquisition cycles', async () => {
  const bag = DiBag.createBuilder().withServices({
    a: DiBag.providerWithTransformedService({ provider: (deps: { b: number }) => deps.b, transformService: value => value, callbackReceives: 'exposed-service' }),
    b: DiBag.providerWithTransformedService({ provider: (deps: { a: number }) => deps.a, transformService: value => value, callbackReceives: 'exposed-service' }),
  }).buildContainer();
  expect(() => bag.resolve('b')).toThrow('cycle');
  await bag.close();
});

test('asynchronous mappings preserve post-await cycle detection', async () => {
  const gate = deferred<void>();
  const bag = DiBag.createBuilder().withServices({
    a: DiBag.providerWithTransformedService({ provider: async (deps: { b: Promise<number> }): Promise<number> => { await gate.promise; return deps.b; }, transformService: value => value, callbackReceives: 'fulfilled-value' }),
    b: DiBag.providerWithTransformedService({ provider: async (deps: { a: Promise<number> }): Promise<number> => { await gate.promise; return deps.a; }, transformService: value => value, callbackReceives: 'fulfilled-value' }),
  }).buildContainer();
  const a = bag.resolve('a');
  const b = bag.resolve('b');
  gate.resolve();
  await expect(a).rejects.toThrow('cycle');
  await expect(b).rejects.toThrow('cycle');
  await bag.close();
});

test('a completed source cannot use its still pending asynchronous projector permission', async () => {
  const gate = deferred<number>();
  let escaped!: { dependency: number };
  const bag = DiBag.createBuilder().withServices({
    service: DiBag.providerWithTransformedService({ provider: (deps: { dependency: number }) => { escaped = deps; return 1; }, transformService: () => gate.promise, callbackReceives: 'fulfilled-value' }),
    dependency: () => 42,
  }).buildContainer();
  bag.resolve('service');
  const closing = bag.close();
  expect(() => escaped.dependency).toThrow('container is closing');
  gate.resolve(42);
  await closing;
});

test('mapping and added finalizers run receiver-free across metadata operations', async () => {
  const events: string[] = [];
  const source = DiBag.providerWithRegistrationMetadata({ provider: DiBag.providerWithDisposal({ provider: () => 4, disposeService: () => { events.push('source'); } }), registrationMetadata: { owner: 'team' } });
  const sync = DiBag.providerWithTransformedService({ provider: source, transformService: function (this: void, value) { expect(this).toBeUndefined(); return value + 1; }, callbackReceives: 'exposed-service' });
  const async = DiBag.providerWithTransformedService({ provider: DiBag.providerWithRegistrationMetadata({ provider: sync, registrationMetadata: { phase: 'mapped' } }), transformService: function (this: void, value) {
    expect(this).toBeUndefined(); return { value };
  }, callbackReceives: 'fulfilled-value' });
  const service = DiBag.providerWithDisposal({ provider: async, disposeService: function (this: void, value) {
    expect(this).toBeUndefined(); expect(value.value).toBe(5); events.push('outer');
  } });
  const bag = DiBag.createBuilder().withServices({ service }).buildContainer();
  expect(bag.serviceSnapshot('service').registrationMetadata).toEqual({ owner: 'team', phase: 'mapped' });
  await expect(bag.resolve('service')).resolves.toEqual({ value: 5 });
  await bag.close();
  expect(events).toEqual(['outer', 'source']);
});

test('failed outer projections retain owned values until a pending projector finishes using them', async () => {
  const gate = deferred<void>();
  const entered = deferred<void>();
  const events: string[] = [];
  const raw = { closed: false };
  const cause = new Error('outer projection');
  const source = DiBag.providerWithDisposal({ provider: () => raw, disposeService: value => {
    expect(value).toBe(raw); value.closed = true; events.push('close');
  } });
  const pending = DiBag.providerWithTransformedService({ provider: source, transformService: async value => {
    entered.resolve();
    await gate.promise;
    expect(value.closed).toBe(false);
    events.push('use');
    return value;
  }, callbackReceives: 'fulfilled-value' });
  const bag = DiBag.createBuilder().withServices({ service: DiBag.providerWithTransformedService({ provider: pending, transformService: () => { throw cause; }, callbackReceives: 'exposed-service' }) }).buildContainer();
  expect(() => bag.resolve('service')).toThrow(cause);
  await entered.promise;
  expect(events).toEqual([]);
  let closed = false;
  const closing = bag.close().then(() => { closed = true; });
  await Promise.resolve();
  expect(closed).toBe(false);
  expect(raw.closed).toBe(false);
  gate.resolve();
  await closing;
  expect(events).toEqual(['use', 'close']);
  expect(closed).toBe(true);
  await bag.close();
  expect(events).toEqual(['use', 'close']);
});

test('failed exposed acquisition abandons incoming edges while its owned source can acquire the recovered parent', async () => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let pending: Promise<{ name: string }> | undefined;
  const events: string[] = [];
  const error = new Error('projection');
  const source = DiBag.providerWithDisposal({ provider: (deps: { parent: { name: string } }) => {
    pending = (async () => { await gate; return { name: deps.parent.name }; })();
    return pending;
  }, disposeService: value => { events.push(value.name); } });
  const bag = DiBag.createBuilder().withServices({
    parent: DiBag.providerWithDisposal({ provider: (deps: { failed: unknown }) => {
      try { void deps.failed; } catch (cause) { if (cause !== error) throw cause; }
      return { name: 'parent' };
    }, disposeService: () => { events.push('parent disposal'); } }),
    failed: DiBag.providerWithTransformedService({ provider: source, transformService: () => { throw error; }, callbackReceives: 'exposed-service' }),
  }).buildContainer();
  expect(bag.resolve('parent')).toEqual({ name: 'parent' });
  const closing = bag.close(); release();
  expect(await pending?.catch(cause => cause)).toEqual({ name: 'parent' });
  await closing;
  expect(events).toEqual(['parent', 'parent disposal']);
});
