import { expect, test } from 'bun:test';
import { DiBag, DiBagCleanupError } from '../src/node';
import { deferred } from './helpers';

test('a projected service does not replace its source disposer argument', async () => {
  const raw = { id: 'connection' };
  const events: string[] = [];
  const source = DiBag.withDisposal(() => raw, value => {
    expect(value).toBe(raw); events.push('raw');
  });
  const client = DiBag.withDisposal(
    DiBag.transformService(source, { mode: 'direct', transform: connection => ({ connection }) }),
    value => { expect(value.connection).toBe(raw); events.push('client'); },
  );
  const bag = DiBag.createBuilder().register({ client }).build();
  expect(bag.resolve('client').connection).toBe(raw);
  await bag.close();
  expect(events).toEqual(['client', 'raw']);
});

test('an ownership operation on a metadata provider retains earlier ownership', async () => {
  const raw = { id: 'same' };
  const events: string[] = [];
  const first = DiBag.withDisposal(() => raw, value => { expect(value).toBe(raw); events.push('first'); });
  const second = DiBag.withDisposal(DiBag.withMetadata(first, { static: { owner: 'team' } }), value => {
    expect(value).toBe(raw); events.push('second');
  });
  const bag = DiBag.createBuilder().register({ second }).build();
  expect(bag.resolve('second')).toBe(raw);
  await bag.close();
  expect(events).toEqual(['second', 'first']);
});

test('direct transformService receives and returns exact Promise identities', async () => {
  const source = Promise.resolve({ id: 'raw' });
  const projected = Promise.resolve({ id: 'client' });
  let calls = 0;
  const bag = DiBag.createBuilder().register({ service: DiBag.transformService(() => { calls++; return source; }, { mode: 'direct', transform: value => {
    expect(value).toBe(source); return projected;
  } }) }).build();
  expect(bag.resolve('service')).toBe(projected);
  expect(bag.resolve('service')).toBe(projected);
  expect(calls).toBe(1);
  await bag.close();
});

test('awaited transformService rejects source and projector throws with their original values', async () => {
  const sourceCause = { error: 'source' };
  const projectCause = { error: 'project' };
  const bag = DiBag.createBuilder().register({
    source: DiBag.transformService(() => { throw sourceCause; }, { mode: 'awaited', transform: value => value }),
    project: DiBag.transformService(() => 1, { mode: 'awaited', transform: () => { throw projectCause; } }),
  }).build();
  await expect(bag.resolve('source')).rejects.toBe(sourceCause);
  await expect(bag.resolve('project')).rejects.toBe(projectCause);
  await bag.close();
});

test('awaited transformService awaits recursive projector thenables and source fulfillment', async () => {
  const nested: PromiseLike<PromiseLike<number>> = {
    then(accept) { return Promise.resolve(accept?.(Promise.resolve(42))) as never; },
  };
  const bag = DiBag.createBuilder().register({ service: DiBag.transformService(() => Promise.resolve('raw'), { mode: 'awaited', transform: value => {
    expect(value).toBe('raw'); return nested;
  } }) }).build();
  await expect(bag.resolve('service')).resolves.toBe(42);
  await bag.close();
});

test('a failed sync projection releases late source ownership', async () => {
  const gate = deferred<{ id: string }>();
  const cause = new Error('project');
  const events: string[] = [];
  const raw = DiBag.withDisposal(() => gate.promise, value => { events.push(value.id); });
  const projected = DiBag.transformService(raw, { mode: 'direct', transform: () => { throw cause; } });
  const bag = DiBag.createBuilder().register({ projected }).build();
  expect(() => bag.resolve('projected')).toThrow(cause);
  const closing = bag.close();
  gate.resolve({ id: 'released' });
  await closing;
  expect(events).toEqual(['released']);
});

test('a synchronous status projection stays cached after its raw Promise rejects', async () => {
  const gate = deferred<number>();
  let calls = 0;
  const bag = DiBag.createBuilder().register({ service: DiBag.transformService(() => { calls++; return gate.promise; }, { mode: 'direct', transform: promise => ({ promise }) }) }).build();
  const status = bag.resolve('service');
  gate.reject('raw failure');
  await gate.promise.catch(() => {});
  expect(bag.resolve('service')).toBe(status);
  expect(status.promise).toBe(gate.promise);
  expect(bag.inspect('service').acquisitions[0]?.state).toBe('ready');
  expect(calls).toBe(1);
  await bag.close();
});

test('ready outer ownership closes before a raw stage accepted later', async () => {
  const gate = deferred<number>();
  const events: string[] = [];
  const source = DiBag.withDisposal(() => gate.promise, () => { events.push('raw'); });
  const outer = DiBag.withDisposal(DiBag.transformService(source, { mode: 'direct', transform: promise => ({ promise }) }), () => { events.push('outer'); });
  const bag = DiBag.createBuilder().register({ outer }).build();
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
  const source = DiBag.withDisposal(({ dep }: { dep: typeof dependency }) => ({ dep }), () => { events.push('source'); });
  const bag = DiBag.createBuilder().register({
    dep: DiBag.withDisposal(() => dependency, () => { events.push('dep'); }),
    failed: DiBag.transformService(source, { mode: 'direct', transform: () => { throw cause; } }),
  }).build();
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
  const source = DiBag.withDisposal(() => 1, async () => { started.resolve(); await gate.promise; });
  const bag = DiBag.createBuilder().register({ failed: DiBag.transformService(source, { mode: 'direct', transform: () => { throw cause; } }) }).build();
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
  const source = DiBag.withDisposal(() => ++count === 1 ? old.promise : Promise.resolve(2), value => { events.push(value); });
  let projections = 0;
  const bag = DiBag.createBuilder().register({ service: DiBag.transformService(source, { mode: 'direct', transform: promise => {
    if (++projections === 1) throw new Error('retry');
    return { promise };
  } }) }).build();
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
  const bag = DiBag.createBuilder().register({ service: DiBag.transformService(DiBag.withDisposal(() => {
    ids.push(bag.inspect('service').acquisitions.at(-1)!.acquisitionId);
    return ids.length === 1 ? 'A' : 'B';
  }, value => { starts.push(value); return value === 'A' ? a.promise : b.promise; }), { mode: 'direct', transform: () => { throw new Error('project'); } }) }).build();
  expect(() => bag.resolve('service')).toThrow('project');
  expect(() => bag.resolve('service')).toThrow('project');
  expect(starts).toEqual(['A', 'B']);
  b.reject(causeB);
  await b.promise.catch(() => {});
  a.reject(undefined);
  const error = await bag.close().catch(error => error);
  expect(error).toBeInstanceOf(DiBagCleanupError);
  expect(error.errors).toEqual([undefined, causeB]);
  expect(error.failures.map((failure: { acquisitionId: symbol }) => failure.acquisitionId)).toEqual(ids);
  expect(error.failures.map((failure: object) => Reflect.ownKeys(failure))).toEqual([
    ['acquisitionId', 'bindingId', 'label', 'error'], ['acquisitionId', 'bindingId', 'label', 'error'],
  ]);
});

test('a pending source can read dependencies in close after an outer projection is ready', async () => {
  const gate = deferred<void>();
  const events: string[] = [];
  const source = DiBag.withDisposal(async (deps: { dependency: number }) => {
    await gate.promise; return deps.dependency;
  }, () => { events.push('source'); });
  const bag = DiBag.createBuilder().register({
    service: DiBag.transformService(source, { mode: 'direct', transform: promise => ({ promise }) }),
    dependency: DiBag.withDisposal(() => 42, () => { events.push('dependency'); }),
  }).build();
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
  const bag = DiBag.createBuilder().register({
    service: DiBag.transformService(DiBag.withDisposal(async (deps: { dependency: number }) => {
      await gate.promise; return deps.dependency;
    }, value => { events.push(`source:${value}`); }), { mode: 'direct', transform: () => { throw new Error('projection'); } }),
    dependency: DiBag.withDisposal(() => 42, () => { events.push('dependency'); }),
  }).build();
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
  const bag = DiBag.createBuilder().register({
    service: DiBag.transformService(source, { mode: 'direct', transform: () => { if (++projected === 1) throw new Error('retry'); return projectionGate.promise; } }),
    dependency: () => 42,
  }).build();
  expect(() => bag.resolve('service')).toThrow('retry');
  bag.resolve('service');
  const closing = bag.close();
  expect(() => escaped.dependency).toThrow('bag is closing');
  projectionGate.resolve(2);
  sourceGate.resolve(2);
  await closing;
});

test('mapped dependencies still reject genuine acquisition cycles', async () => {
  const bag = DiBag.createBuilder().register({
    a: DiBag.transformService((deps: { b: number }) => deps.b, { mode: 'direct', transform: value => value }),
    b: DiBag.transformService((deps: { a: number }) => deps.a, { mode: 'direct', transform: value => value }),
  }).build();
  expect(() => bag.resolve('b')).toThrow('cycle');
  await bag.close();
});

test('asynchronous mappings preserve post-await cycle detection', async () => {
  const gate = deferred<void>();
  const bag = DiBag.createBuilder().register({
    a: DiBag.transformService(async (deps: { b: Promise<number> }): Promise<number> => { await gate.promise; return deps.b; }, { mode: 'awaited', transform: value => value }),
    b: DiBag.transformService(async (deps: { a: Promise<number> }): Promise<number> => { await gate.promise; return deps.a; }, { mode: 'awaited', transform: value => value }),
  }).build();
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
  const bag = DiBag.createBuilder().register({
    service: DiBag.transformService((deps: { dependency: number }) => { escaped = deps; return 1; }, { mode: 'awaited', transform: () => gate.promise }),
    dependency: () => 42,
  }).build();
  bag.resolve('service');
  const closing = bag.close();
  expect(() => escaped.dependency).toThrow('bag is closing');
  gate.resolve(42);
  await closing;
});

test('mapping and added finalizers run receiver-free across metadata operations', async () => {
  const events: string[] = [];
  const source = DiBag.withMetadata(DiBag.withDisposal(() => 4, () => { events.push('source'); }), { static: { owner: 'team' } });
  const sync = DiBag.transformService(source, { mode: 'direct', transform: function (this: void, value) { expect(this).toBeUndefined(); return value + 1; } });
  const async = DiBag.transformService(DiBag.withMetadata(sync, { static: { phase: 'mapped' } }), { mode: 'awaited', transform: function (this: void, value) {
    expect(this).toBeUndefined(); return { value };
  } });
  const service = DiBag.withDisposal(async, function (this: void, value) {
    expect(this).toBeUndefined(); expect(value.value).toBe(5); events.push('outer');
  });
  const bag = DiBag.createBuilder().register({ service }).build();
  expect(bag.inspect('service').registrationMetadata).toEqual({ owner: 'team', phase: 'mapped' });
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
  const source = DiBag.withDisposal(() => raw, value => {
    expect(value).toBe(raw); value.closed = true; events.push('close');
  });
  const pending = DiBag.transformService(source, { mode: 'awaited', transform: async value => {
    entered.resolve();
    await gate.promise;
    expect(value.closed).toBe(false);
    events.push('use');
    return value;
  } });
  const bag = DiBag.createBuilder().register({ service: DiBag.transformService(pending, { mode: 'direct', transform: () => { throw cause; } }) }).build();
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
  const source = DiBag.withDisposal((deps: { parent: { name: string } }) => {
    pending = (async () => { await gate; return { name: deps.parent.name }; })();
    return pending;
  }, value => { events.push(value.name); });
  const bag = DiBag.createBuilder().register({
    parent: DiBag.withDisposal((deps: { failed: unknown }) => {
      try { void deps.failed; } catch (cause) { if (cause !== error) throw cause; }
      return { name: 'parent' };
    }, () => { events.push('parent disposal'); }),
    failed: DiBag.transformService(source, { mode: 'direct', transform: () => { throw error; } }),
  }).build();
  expect(bag.resolve('parent')).toEqual({ name: 'parent' });
  const closing = bag.close(); release();
  expect(await pending?.catch(cause => cause)).toEqual({ name: 'parent' });
  await closing;
  expect(events).toEqual(['parent', 'parent disposal']);
});
