import { expect, test } from 'bun:test';
import { DiBag, DiBagCleanupError } from '../src/node';
import { deferred } from './helpers';
import { AcquisitionFamily } from '../src/acquisition-family';
import type { AttemptIdentity } from '../src/acquisition-family';

// Deliberate JS boundary: only invalid captive fixtures bypass Builder.end checks.
function uncheckedRuntimeGraph(builder: { end: Function }) { return builder.end(); }

test('root, scoped and transient identity have distinct ownership', async () => {
  const log: string[] = [];
  const registration = (label: string) => DiBag.withDisposal(
    () => ({ label }), value => { log.push(value.label); },
  );
  const parent = DiBag.begin().add({
    root: DiBag.withLifetime(registration('root'), 'root'),
    scoped: registration('scoped'),
    transient: DiBag.withLifetime(registration('transient'), 'transient'),
  }).end();
  const child = parent.scope();
  expect(child.inspect('root').acquisitions).toHaveLength(0);
  expect(parent.inspect('root').acquisitions).toHaveLength(0);
  const shared = child.resolve('root');
  expect(parent.resolve('root')).toBe(shared);
  expect(child.resolve('scoped')).not.toBe(parent.resolve('scoped'));
  expect(child.resolve('transient')).not.toBe(child.resolve('transient'));
  expect(child.inspect('root').acquisitions).toEqual(parent.inspect('root').acquisitions);
  expect(child.inspect('transient').acquisitions).toHaveLength(2);
  expect(parent.inspect('transient').acquisitions).toHaveLength(0);
  await child.close();
  expect(log.filter(value => value === 'root')).toHaveLength(0);
  expect(log.filter(value => value === 'transient')).toHaveLength(2);
  expect(child.inspect('transient').acquisitions).toHaveLength(0);
  await parent.close();
  expect(log.filter(value => value === 'root')).toHaveLength(1);
});

test('child-first roots capture dependencies in the root owner through grandchildren and forks', async () => {
  const events: string[] = [];
  const parent = DiBag.begin().add({
    scoped: DiBag.withDisposal(() => ({}), () => { events.push('scoped'); }),
    transient: DiBag.withLifetime(DiBag.withDisposal(() => ({}), () => { events.push('transient'); }), 'transient'),
    root: DiBag.withLifetime(DiBag.withDisposal((deps: { scoped: object; transient: object }) =>
      ({ scoped: deps.scoped, transient: deps.transient }), () => { events.push('root'); }), 'root', { captureScoped: true }),
  }).end();
  const child = parent.scope();
  const grandchild = child.scope();
  const fork = child.fork();
  const acquired = grandchild.resolve('root');
  expect(acquired).toBe(child.resolve('root'));
  expect(acquired.scoped).toBe(parent.resolve('scoped'));
  expect(acquired.scoped).not.toBe(child.resolve('scoped'));
  expect(parent.inspect('transient').acquisitions).toHaveLength(1);
  expect(grandchild.inspect('transient').acquisitions).toHaveLength(0);
  expect(fork.resolve('root')).not.toBe(acquired);
  await child.close();
  expect(events).toEqual(['scoped']);
  await parent.close();
  expect(events).toEqual(['scoped', 'root', 'transient', 'scoped']);
  expect(fork.resolve('root').scoped).toBe(fork.resolve('scoped'));
  await fork.close();
});

test('same-object transients own separate attempts and preserve every cleanup cause', async () => {
  const value = {};
  const cause = new Error('cleanup');
  const bag = DiBag.begin().add({
    value: DiBag.withLifetime(DiBag.withDisposal(() => value, () => { throw cause; }), 'transient'),
  }).end();
  expect(bag.resolve('value')).toBe(value);
  expect(bag.resolve('value')).toBe(value);
  const ids = bag.inspect('value').acquisitions.map(item => item.acquisitionId);
  expect(new Set(ids).size).toBe(2);
  const closing = bag.close();
  expect(bag.close()).toBe(closing);
  const error: unknown = await closing.catch(error => error);
  expect(error).toBeInstanceOf(DiBagCleanupError);
  if (!(error instanceof DiBagCleanupError)) throw new Error('missing cleanup error');
  expect(error.errors).toEqual([cause, cause]);
  expect(error.failures.map(item => item.acquisitionId)).toEqual([...ids].reverse());
  expect(bag.inspect('value').acquisitions).toHaveLength(0);
});

test('raw and native lifetimes retain original pending promises and classification', async () => {
  const gate = deferred<object>();
  const rawDisposed: Promise<object>[] = [];
  const nativeDisposed: object[] = [];
  const bag = DiBag.begin().add({
    raw: DiBag.withLifetime(DiBag.withDisposal(DiBag.factory(() => gate.promise, { acquisition: 'raw' }), value => { rawDisposed.push(value); }), 'root'),
    native: DiBag.withLifetime(DiBag.withDisposal(DiBag.factory(() => gate.promise, { acquisition: 'native' }), value => { nativeDisposed.push(value); }), 'transient'),
  }).end();
  const child = bag.scope();
  expect(child.resolve('raw')).toBe(gate.promise);
  expect(bag.resolve('raw')).toBe(gate.promise);
  expect(child.inspect('raw').acquisitions.map(item => item.state)).toEqual(['ready']);
  expect(child.resolve('native')).toBe(gate.promise);
  expect(child.resolve('native')).toBe(gate.promise);
  expect(child.inspect('native').acquisitions.map(item => item.state)).toEqual(['pending', 'pending']);
  const closing = child.close();
  const value = {};
  gate.resolve(value);
  await closing;
  expect(nativeDisposed).toEqual([value, value]);
  expect(rawDisposed).toEqual([]);
  await bag.close();
  expect(rawDisposed).toEqual([gate.promise]);
});

test('failed root cache entries retry across children with new acquisition identities', async () => {
  const gate = deferred<number>();
  let calls = 0;
  const bag = DiBag.begin().add({ root: DiBag.withLifetime(() => ++calls === 1 ? gate.promise : Promise.resolve(42), 'root') }).end();
  const child = bag.scope();
  expect(child.resolve('root')).toBe(gate.promise);
  expect(bag.resolve('root')).toBe(gate.promise);
  const first = bag.inspect('root').acquisitions[0]!.acquisitionId;
  gate.reject(new Error('retry'));
  await expect(gate.promise).rejects.toThrow('retry');
  const retry = bag.resolve('root');
  expect(child.resolve('root')).toBe(retry);
  expect(await retry).toBe(42);
  expect(bag.inspect('root').acquisitions[0]!.acquisitionId).not.toBe(first);
  expect(calls).toBe(2);
  await bag.close();
});

test('public synchronous transient reentrancy is rejected before a second factory invocation', async () => {
  let calls = 0;
  let reenter = (): object => ({});
  const bag = DiBag.begin().add({ value: DiBag.withLifetime(() => { calls++; return reenter(); }, 'transient') }).end();
  reenter = () => bag.resolve('value');
  expect(reenter).toThrow('cycle: value -> value');
  expect(calls).toBe(1);
  await bag.close();
});

test('pure transient post-await ancestry rejects repeated construction', async () => {
  const gate = deferred<void>();
  let calls = 0;
  const bag = DiBag.begin().add({
    a: DiBag.withLifetime(async (deps: { b: Promise<number> }): Promise<number> => { calls++; await gate.promise; return deps.b; }, 'transient'),
    b: DiBag.withLifetime(async (deps: { a: Promise<number> }): Promise<number> => { await gate.promise; return deps.a; }, 'transient'),
  }).end();
  const a = bag.resolve('a');
  gate.resolve();
  await expect(a).rejects.toThrow('cycle: a -> b -> a');
  expect(calls).toBe(1);
  await bag.close();
});

test('mixed cached and transient post-await cycles preserve acquisition graph detection', async () => {
  const gate = deferred<void>();
  const bag = DiBag.begin().add({
    a: async (deps: { b: Promise<number> }): Promise<number> => { await gate.promise; return deps.b; },
    b: DiBag.withLifetime(async (deps: { a: Promise<number> }): Promise<number> => { await gate.promise; return deps.a; }, 'transient'),
  }).end();
  const a = bag.resolve('a');
  const b = bag.resolve('b');
  gate.resolve();
  await expect(a).rejects.toThrow('cycle');
  await expect(b).rejects.toThrow('cycle');
  await bag.close();
});

test('independent pending transient calls are distinct nonrecursive acquisitions', async () => {
  const gates = [deferred<number>(), deferred<number>()];
  let calls = 0;
  const bag = DiBag.begin().add({ value: DiBag.withLifetime(() => gates[calls++]!.promise, 'transient') }).end();
  const a = bag.resolve('value');
  const b = bag.resolve('value');
  expect(a).toBe(gates[0]!.promise);
  expect(b).toBe(gates[1]!.promise);
  gates[1]!.resolve(2);
  gates[0]!.resolve(1);
  expect(await Promise.all([a, b])).toEqual([1, 2]);
  await bag.close();
});

test('a ready transient proxy may create a fresh instance on each later method call', async () => {
  type Value = { next(): Value };
  let calls = 0;
  const bag = DiBag.begin().add({ value: DiBag.withLifetime((deps: { value: Value }): Value => {
    calls++; return { next: () => deps.value };
  }, 'transient') }).end();
  const first = bag.resolve('value');
  const second = first.next();
  expect(second).not.toBe(first);
  expect(first.next()).not.toBe(second);
  expect(second.next()).not.toBe(second);
  expect(calls).toBe(4);
  await bag.close();
});

test('pending child work acquires roots during parent close and root cleanup follows child cleanup', async () => {
  const gate = deferred<void>();
  const events: string[] = [];
  const bag = DiBag.begin().add({
    root: DiBag.withLifetime(DiBag.withDisposal(() => { events.push('root:open'); return {}; }, () => { events.push('root:close'); }), 'root'),
    child: DiBag.withDisposal(async (deps: { root: object }) => { await gate.promise; return deps.root; }, () => { events.push('child:close'); }),
  }).end();
  const child = bag.scope();
  const pending = child.resolve('child');
  const closing = bag.close();
  expect(() => child.resolve('root')).toThrow('bag is closing');
  expect(() => bag.resolve('root')).toThrow('bag is closing');
  gate.resolve();
  expect(await pending).toEqual({});
  await closing;
  expect(events).toEqual(['root:open', 'child:close', 'root:close']);
});

for (const cached of [false, true]) for (const intermediate of [false, true]) {
  test(`strict roots reject ${cached ? 'cached' : 'new'} scoped reads ${intermediate ? 'through a transient' : 'directly'}`, async () => {
    let factories = 0;
    let returned = 0;
    const bag = uncheckedRuntimeGraph(DiBag.begin().add({
      scoped: () => { factories++; return {}; },
      bridge: DiBag.withLifetime((deps: { scoped: object }) => { const result = deps.scoped; returned++; return result; }, 'transient'),
      root: DiBag.withLifetime((deps: { scoped: object; bridge: object }) => {
        const result = intermediate ? deps.bridge : deps.scoped; returned++; return result;
      }, 'root'),
    }));
    if (cached) bag.resolve('scoped');
    expect(() => bag.scope().resolve('root')).toThrow('root lifetime cannot capture scoped dependency');
    expect(factories).toBe(cached ? 1 : 0);
    expect(returned).toBe(0);
    await bag.close();
  });
}

test('strict capture boundaries survive await and ready transient methods', async () => {
  const gate = deferred<void>();
  let factories = 0;
  type Bridge = { read(): number; next(): Bridge };
  const bag = uncheckedRuntimeGraph(DiBag.begin().add({
    scoped: () => { factories++; return 42; },
    bridge: DiBag.withLifetime((deps: { scoped: number; bridge: Bridge }): Bridge => ({ read: () => deps.scoped, next: () => deps.bridge }), 'transient'),
    root: DiBag.withLifetime(async (deps: { bridge: Bridge }) => { await gate.promise; return deps.bridge; }, 'root'),
    direct: DiBag.withLifetime(async (deps: { scoped: number }) => { await gate.promise; return deps.scoped; }, 'root'),
  }));
  const pending: Promise<Bridge> = bag.scope().resolve('root');
  const direct: Promise<number> = bag.resolve('direct');
  gate.resolve();
  await expect(direct).rejects.toThrow('root lifetime cannot capture scoped dependency');
  const bridge = await pending;
  expect(bridge.read).toThrow('root lifetime cannot capture scoped dependency');
  const next = bridge.next();
  expect(next).not.toBe(bridge);
  expect(next.read).toThrow('root lifetime cannot capture scoped dependency');
  expect(factories).toBe(0);
  await bag.close();
});

test('strict roots can consume capturing roots without inheriting their permission', async () => {
  const bag = uncheckedRuntimeGraph(DiBag.begin().add({
    scoped: () => ({}),
    capturing: DiBag.withLifetime((deps: { scoped: object }) => deps.scoped, 'root', { captureScoped: true }),
    strict: DiBag.withLifetime((deps: { capturing: object }) => deps.capturing, 'root'),
    other: DiBag.withLifetime((deps: { capturing: object; scoped: object }) => { void deps.capturing; return deps.scoped; }, 'root'),
  }));
  const child = bag.scope();
  expect(child.resolve('strict')).toBe(bag.resolve('scoped'));
  expect(child.resolve('strict')).not.toBe(child.resolve('scoped'));
  expect(() => child.resolve('other')).toThrow('root lifetime cannot capture scoped dependency');
  await bag.close();
});

test('token captive reads reject at the observed edge before scoped creation', async () => {
  const key = Symbol('scoped');
  const token = DiBag.token(key).of<number>();
  let factories = 0;
  const bag = uncheckedRuntimeGraph(DiBag.begin().bind(token, () => { factories++; return 42; }).add({
    root: DiBag.withLifetime(DiBag.fromTokens([token], value => value), 'root'),
  }));
  expect(() => bag.scope().resolve('root')).toThrow('root lifetime cannot capture scoped dependency');
  expect(factories).toBe(0);
  await bag.close();
});

test('renamed module exports retain private root and transient ownership despite public collisions', async () => {
  let sequence = 0;
  const events: number[] = [];
  const feature = DiBag.module().add({
    privateRoot: DiBag.withLifetime(DiBag.withDisposal(() => ({ id: ++sequence }), value => { events.push(value.id); }), 'root'),
    bridge: DiBag.withLifetime(DiBag.withDisposal((deps: { privateRoot: { id: number } }) => ({ root: deps.privateRoot, id: ++sequence }), value => { events.push(value.id); }), 'transient'),
    read: (deps: { bridge: { root: { id: number }; id: number } }) => () => deps.bridge,
  }).exports(['read', 'bridge']).rename('bridge', 'privateRoot');
  const parent = DiBag.begin().install(feature).end();
  const child = parent.scope();
  const first = child.resolve('read')();
  const second = child.resolve('privateRoot');
  expect(first.id).toBe(2);
  expect(second.id).toBe(3);
  expect(second.root).toBe(first.root);
  const rootOwned = parent.resolve('privateRoot');
  expect(rootOwned.root).toBe(first.root);
  await child.close();
  expect(events).toEqual([3, 2]);
  await parent.close();
  expect(events).toEqual([3, 2, 4, 1]);
});

test('private module scoped capture rejects despite an identically named public root', async () => {
  let calls = 0;
  const feature = DiBag.module().add({
    scoped: () => { calls++; return 1; },
    bridge: DiBag.withLifetime((deps: { scoped: number }) => deps.scoped, 'transient'),
  }).exports(['bridge']).rename('bridge', 'exported');
  const bag = uncheckedRuntimeGraph(DiBag.begin().install(feature).add({
    scoped: DiBag.withLifetime(() => 2, 'root'),
    root: DiBag.withLifetime((deps: { exported: number }) => deps.exported, 'root'),
  }));
  expect(() => bag.scope().resolve('root')).toThrow('root lifetime cannot capture scoped dependency');
  expect(calls).toBe(0);
  await bag.close();
});

test('failed root rollback and retry retain distinct ownership across child consumers', async () => {
  const rollback = deferred<void>();
  const events: string[] = [];
  const failure = new Error('projection');
  const cleanupFailure = new Error('rollback');
  let calls = 0;
  const source = DiBag.withDisposal((deps: { dependency: object }) => ({ dependency: deps.dependency, id: ++calls }), async value => {
    events.push(`root:${value.id}:start`);
    if (value.id === 1) { await rollback.promise; events.push('root:1:end'); throw cleanupFailure; }
  });
  const bag = DiBag.begin().add({
    dependency: DiBag.withLifetime(DiBag.withDisposal(() => ({}), () => { events.push('dependency'); }), 'root'),
    root: DiBag.withLifetime(DiBag.mapSync(source, value => { if (value.id === 1) throw failure; return value; }), 'root'),
    child: DiBag.withDisposal((deps: { root: { dependency: object; id: number } }) => {
      try { void deps.root; } catch {}
      return () => deps.root;
    }, () => { events.push('child'); }),
  }).end();
  const child = bag.scope();
  const retry = child.resolve('child');
  const first = bag.inspect('root').acquisitions[0]!;
  expect(first.state).toBe('failed');
  expect(retry().id).toBe(2);
  expect(bag.inspect('root').acquisitions.map(item => item.state)).toEqual(['failed', 'ready']);
  expect(child.resolve('root')).toBe(retry());
  const closing = bag.close();
  rollback.resolve();
  const error: unknown = await closing.catch(error => error);
  expect(error).toBeInstanceOf(DiBagCleanupError);
  if (!(error instanceof DiBagCleanupError)) throw new Error('missing cleanup failure');
  expect(error.failures.map(item => item.error)).toEqual([cleanupFailure]);
  expect(error.failures[0]!.acquisitionId).toBe(first.acquisitionId);
  expect(events.indexOf('child')).toBeLessThan(events.indexOf('root:2:start'));
  expect(events.indexOf('root:1:end')).toBeLessThan(events.indexOf('dependency'));
  expect(events.at(-1)).toBe('dependency');
});

test('child close releases its attempts while a child-first root remains pending', async () => {
  const gate = deferred<void>();
  const bag = DiBag.begin().add({
    dependency: DiBag.withLifetime(() => ({}), 'root'),
    root: DiBag.withLifetime(async (deps: { dependency: object }) => { await gate.promise; return deps.dependency; }, 'root'),
    child: (deps: { root: Promise<object> }) => ({ root: deps.root }),
  }).end();
  const child = bag.scope();
  const pending = child.resolve('child').root;
  await child.close();
  expect(child.inspect('child').acquisitions).toHaveLength(0);
  expect(bag.inspect('root').acquisitions.map(item => item.state)).toEqual(['pending']);
  gate.resolve();
  expect(await pending).toBe(bag.resolve('dependency'));
  expect(bag.resolve('root')).toBe(pending);
  await bag.close();
});

test('completed child and retired proxies cannot borrow another attempt closing permission for root reads', async () => {
  const gate = deferred<number>();
  let first = true;
  let stale = () => 0;
  let rootCalls = 0;
  const bag = DiBag.begin().add({
    root: DiBag.withLifetime(() => { rootCalls++; return 42; }, 'root'),
    read: (deps: { root: number }) => () => deps.root,
    retry: (deps: { root: number }) => {
      if (first) { first = false; stale = () => deps.root; throw new Error('failed'); }
      return gate.promise;
    },
  }).end();
  const child = bag.scope();
  const read = child.resolve('read');
  expect(() => child.resolve('retry')).toThrow('failed');
  expect(child.resolve('retry')).toBe(gate.promise);
  const closing = bag.close();
  expect(read).toThrow('bag is closing');
  expect(stale).toThrow('bag is closing');
  expect(rootCalls).toBe(0);
  gate.resolve(1);
  await closing;
  expect(stale).toThrow('bag is closed');
});

test('pending source permission survives a ready projection when routing late roots', async () => {
  const gate = deferred<void>();
  const events: string[] = [];
  const bag = DiBag.begin().add({
    root: DiBag.withLifetime(DiBag.withDisposal(() => 42, () => { events.push('root'); }), 'root'),
    child: DiBag.mapSync(DiBag.withDisposal(async (deps: { root: number }) => { await gate.promise; return deps.root; }, () => { events.push('child'); }), () => 7),
  }).end();
  const child = bag.scope();
  expect(child.resolve('child')).toBe(7);
  expect(child.inspect('child').acquisitions.map(item => item.state)).toEqual(['ready']);
  const closing = bag.close();
  gate.resolve();
  await closing;
  expect(events).toEqual(['child', 'root']);
});

test('family retirement removes cross-owner incoming edges but preserves outgoing rollback dependencies', () => {
  const family = new AcquisitionFamily();
  const identity = (label: string, ownerId: symbol): AttemptIdentity => ({
    id: Symbol(label), bindingId: Symbol(label), ownerId, label,
    dependencies: new Set(), ancestry: [], state: 'pending',
  });
  const rootOwner = Symbol('root');
  const child = identity('child', Symbol('child'));
  const failed = identity('failed root', rootOwner);
  const dependency = identity('root dependency', rootOwner);
  for (const attempt of [child, failed, dependency]) family.add(attempt);
  family.recordEdge(child, failed);
  family.recordEdge(failed, dependency);
  failed.state = 'failed';
  family.retireIncoming(failed);
  expect(() => family.recordEdge(dependency, child)).not.toThrow();
  // Rollback still needs the failed attempt's outgoing dependency.
  expect(() => family.recordEdge(child, failed)).toThrow('cycle');
  family.release(failed);
  expect(() => family.recordEdge(child, failed)).not.toThrow();
  family.release(child);
  expect(() => family.recordEdge(child, dependency)).not.toThrow();
});

test('retired transient ancestry does not block a retained proxy from retrying its binding', async () => {
  let calls = 0;
  let retry = () => 0;
  const bag = DiBag.begin().add({ value: DiBag.withLifetime((deps: { value: number }): number => {
    if (++calls === 1) { retry = () => deps.value; throw new Error('failed'); }
    return calls;
  }, 'transient') }).end();
  expect(() => bag.resolve('value')).toThrow('failed');
  expect(retry()).toBe(2);
  expect(retry()).toBe(3);
  expect(bag.inspect('value').acquisitions).toHaveLength(2);
  await bag.close();
});

test('token roots retain family ownership through a transient token consumer and independent override', async () => {
  const key = Symbol('root');
  const token = DiBag.token(key).of<object>();
  let closed = 0;
  const bag = DiBag.begin().bind(token, DiBag.withLifetime(DiBag.withDisposal(() => ({}), () => { closed++; }), 'root')).add({
    bridge: DiBag.withLifetime(DiBag.fromTokens([token], root => ({ root })), 'transient'),
  }).end();
  const child = bag.scope();
  expect(child.resolve('bridge').root).toBe(bag.resolve(token));
  const replacement = {};
  const fork = bag.fork([token], { [key]: DiBag.withLifetime(() => replacement, 'root') });
  expect(fork.resolve('bridge').root).toBe(replacement);
  await child.close();
  expect(closed).toBe(0);
  await bag.close();
  expect(closed).toBe(1);
  await fork.close();
});

test('pending source permission survives failed projection rollback for late root reads', async () => {
  const gate = deferred<void>();
  const events: string[] = [];
  const bag = DiBag.begin().add({
    root: DiBag.withLifetime(DiBag.withDisposal(() => 42, () => { events.push('root'); }), 'root'),
    child: DiBag.mapSync(DiBag.withDisposal(async (deps: { root: number }) => { await gate.promise; return deps.root; }, () => { events.push('child'); }), (): number => { throw new Error('projection'); }),
  }).end();
  const child = bag.scope();
  expect(() => child.resolve('child')).toThrow('projection');
  expect(child.inspect('child').acquisitions.map(item => item.state)).toEqual(['failed']);
  const closing = bag.close();
  gate.resolve();
  await closing;
  expect(events).toEqual(['child', 'root']);
});
