import { expect, test } from 'bun:test';
import { DiBag } from '../src';
import { fromTokens, withTokenBinding } from '../src/provider';
import { normalize } from '../src/provider-operations';
import { BindingGraph, Runtime } from '../src/runtime';
import { readTokenKey, snapshotTokens } from '../src/tokens';

test('token symbols participate in the same acquisition graph', async () => {
  const key = Symbol('resource');
  const resource = DiBag.token(key).of<{ read(): number }>();
  const disposed: string[] = [];
  const owned = DiBag.withDisposal(() => ({ read: () => 42 }), () => { disposed.push('resource'); });
  const use = DiBag.withDisposal(fromTokens([resource], value => ({ read: () => value.read() })),
    () => { disposed.push('consumer'); });
  const runtime = new Runtime(new BindingGraph().withPublicBinding(key, owned).withPublicRegistrations({ use }));
  expect((runtime.resolve('use') as { read(): number }).read()).toBe(42);
  await runtime.close();
  expect(disposed).toEqual(['consumer', 'resource']);
});

test('handles authenticate identity and capture a receiver-free symbol', () => {
  const key = Symbol('same'); const other = Symbol('same');
  const { of } = DiBag.token(key);
  const token = of<number>(); const again = DiBag.token(key).of<number>();
  expect(Object.isFrozen(token)).toBe(true);
  expect(readTokenKey(token)).toBe(key);
  expect(readTokenKey(again)).toBe(key);
  expect(readTokenKey(DiBag.token(other).of<number>())).not.toBe(key);
  for (const invalid of [{ ...token }, { key }, Object.create(token), new Proxy(token, {}), null, key]) {
    expect(() => readTokenKey(invalid)).toThrow('invalid token');
  }
  expect(() => Reflect.apply(DiBag.token, undefined, ['fake'])).toThrow('symbol');
});

test('indexed snapshots ignore iterators and caller mutations', async () => {
  const aKey = Symbol('a'); const bKey = Symbol('b');
  const a = DiBag.token(aKey).of<number>(); const b = DiBag.token(bKey).of<number>();
  const selected: [typeof a, typeof b] = [a, b];
  selected[Symbol.iterator] = function* () { yield b; yield a; return undefined; };
  const order: string[] = [];
  const use = fromTokens(selected, (first, second) => [first, second]);
  selected.reverse();
  const snapshot = snapshotTokens([a, b]);
  expect(Object.isFrozen(snapshot)).toBe(true);
  const runtime = new Runtime(new BindingGraph()
    .withPublicBinding(aKey, () => { order.push('a'); return 1; })
    .withPublicBinding(bKey, () => { order.push('b'); return 2; })
    .withPublicRegistrations({ use }));
  expect(runtime.resolve('use')).toEqual([1, 2]);
  expect(order).toEqual(['a', 'b']);
  await runtime.close();
});

test('invalid selections fail before callbacks and binding transforms', () => {
  const key = Symbol('value'); const token = DiBag.token(key).of<number>();
  let called = 0;
  for (const invalid of [[token, { ...token }], [token, undefined], { 0: token, length: 1 }, null]) {
    expect(() => Reflect.apply(fromTokens, undefined, [invalid, () => { called++; }])).toThrow();
  }
  expect(() => Reflect.apply(withTokenBinding, undefined, [{ ...token }, () => { called++; }])).toThrow('invalid token');
  expect(called).toBe(0);
});

test('same actual symbols and repeated token reads reuse one cache slot', async () => {
  const key = Symbol.for('di-bag-test-resource'); const sameKey = Symbol.for('di-bag-test-resource');
  const a = DiBag.token(key).of<object>(); const b = DiBag.token(sameKey).of<object>();
  let calls = 0; const value = {};
  const runtime = new Runtime(new BindingGraph().withPublicBinding(key, () => { calls++; return value; })
    .withPublicRegistrations({ use: fromTokens([a, b, a], (...values) => values) }));
  const result = runtime.resolve('use') as object[];
  expect(result.every(item => item === value)).toBe(true);
  expect(runtime.resolve(sameKey)).toBe(value);
  expect(calls).toBe(1);
  await runtime.close();
});

test('distinct symbols with the same description resolve independent slots', async () => {
  const firstKey = Symbol('same'); const secondKey = Symbol('same');
  const first = DiBag.token(firstKey).of<number>(); const second = DiBag.token(secondKey).of<number>();
  const runtime = new Runtime(new BindingGraph().withPublicBinding(firstKey, () => 1).withPublicBinding(secondKey, () => 2)
    .withPublicRegistrations({ use: fromTokens([first, second], (a, b) => [a, b]) }));
  expect(runtime.resolve('use')).toEqual([1, 2]); await runtime.close();
});

test('symbol dependencies follow lexical private and public references', async () => {
  const localKey = Symbol('local'); const publicKey = Symbol('public');
  const selected = DiBag.token(localKey).of<number>();
  const privateId = Symbol('private'); const consumerId = Symbol('consumer');
  for (const ref of [{ kind: 'private' as const, id: privateId }, { kind: 'public' as const, key: publicKey }]) {
    const runtime = new Runtime(new BindingGraph({
      bindings: new Map([
        [privateId, { id: privateId, label: 'private', registration: () => 41, localNames: new Map() }],
        [consumerId, { id: consumerId, label: 'consumer', registration: fromTokens([selected], value => value + 1), localNames: new Map([[localKey, ref]]) }],
      ]), publicSlots: new Map([['consumer', consumerId]]),
    }).withPublicBinding(publicKey, () => 9));
    expect(runtime.resolve('consumer')).toBe(ref.kind === 'private' ? 42 : 10);
    await runtime.close();
  }
});

test('token and named cycles report symbol labels in both entry orders', async () => {
  const key = Symbol('cycle'); const token = DiBag.token(key).of<number>();
  const graph = new BindingGraph().withPublicBinding(key, ({ named }: { named: number }) => named)
    .withPublicRegistrations({ named: fromTokens([token], value => value) });
  for (const start of [key, 'named']) {
    const runtime = new Runtime(graph);
    expect(() => runtime.resolve(start)).toThrow(/cycle:.*Symbol\(cycle\)/);
    await runtime.close();
  }
  expect(() => new Runtime(new BindingGraph()).resolve(key)).toThrow('no factory for Symbol(cycle)');
});

test('rejected token acquisitions retry without awaiting callback arguments', async () => {
  const key = Symbol('promise'); const token = DiBag.token(key).of<Promise<number>>();
  let calls = 0; let selected: Promise<number> | undefined;
  const runtime = new Runtime(new BindingGraph().withPublicBinding(key, () => {
    calls++; return calls === 1 ? Promise.reject(new Error('retry')) : Promise.resolve(42);
  }).withPublicRegistrations({ use: fromTokens([token], value => { selected = value; return value; }) }));
  const first = runtime.resolve('use'); expect(first).toBe(selected);
  await expect(first).rejects.toThrow('retry');
  await Promise.resolve();
  const second = runtime.resolve('use'); expect(second).toBe(selected);
  expect(await second).toBe(42); expect(calls).toBe(2);
  await runtime.close();
});

test('late named reads from a token-bound source retain close permission and disposal order', async () => {
  const key = Symbol('late'); const token = DiBag.token(key).of<Promise<number>>();
  const disposed: string[] = [];
  let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
  const late = DiBag.withDisposal(async (deps: { resource: number }) => { await gate; return deps.resource; }, () => { disposed.push('late'); });
  const runtime = new Runtime(new BindingGraph().withPublicBinding(key, late).withPublicRegistrations({
    resource: DiBag.withDisposal(() => 42, () => { disposed.push('resource'); }),
    use: DiBag.withDisposal(fromTokens([token], value => value), () => { disposed.push('use'); }),
  }));
  const result = runtime.resolve('use'); const closing = runtime.close(); release();
  expect(await result).toBe(42); await closing;
  expect(disposed).toEqual(['use', 'late', 'resource']);
});

test('undeclared well-known symbol reads remain undefined', async () => {
  const runtime = new Runtime(new BindingGraph().withPublicBinding(Symbol.iterator, () => 42).withPublicRegistrations({
    use: (deps: {}) => Reflect.get(deps, Symbol.iterator),
  }));
  expect(runtime.resolve('use')).toBeUndefined(); await runtime.close();
});

test('binding views and transformations retain frozen source selection without mutating inputs', async () => {
  const key = Symbol('value'); const token = DiBag.token(key).of<number>();
  const boundKey = Symbol('bound'); const bound = DiBag.token(boundKey).of<number>();
  const source = fromTokens([token], value => value);
  const mapped = DiBag.mapSync(DiBag.withMetadata(DiBag.withDisposal(source, () => {}), { owner: 'test' }), value => value + 1);
  const view = withTokenBinding(bound, mapped);
  expect(normalize(view).tokenKeys).toEqual([key]);
  expect(Object.isFrozen(normalize(view).tokenKeys)).toBe(true);
  const runtime = new Runtime(new BindingGraph().withPublicBinding(key, () => 41).withPublicRegistrations({ source, mapped, view }));
  expect(runtime.resolve('source')).toBe(41); expect(runtime.resolve('mapped')).toBe(42); expect(runtime.resolve('view')).toBe(42);
  await runtime.close();
});
