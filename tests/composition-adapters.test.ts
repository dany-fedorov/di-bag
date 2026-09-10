import { expect, test } from 'bun:test';
import { DiBag } from '../src/node';
import { DiBag as Core } from '../src';

const portKey = Symbol('port');
const port = DiBag.token(portKey).of<number>();

class Client {
  #port: number;
  readonly target: unknown;
  constructor(readonly port: number) { this.#port = port; this.target = new.target; }
  read() { return this.#port; }
}

test('class adapters construct lazily with private fields, inherited prototypes and new.target', async () => {
  let calls = 0;
  class Derived extends Client { constructor(value: number) { super(value); calls++; } }
  const source = DiBag.fromClass([port], Derived);
  const bag = DiBag.createBuilder().register(port, () => 8080).register({ source }).build();
  expect(calls).toBe(0);
  const client = bag.resolve('source');
  expect(client).toBeInstanceOf(Derived);
  expect(client).toBeInstanceOf(Client);
  expect(client.read()).toBe(8080);
  expect(client.target).toBe(Derived);
  expect(bag.resolve('source')).toBe(client);
  expect(calls).toBe(1);
  await bag.close();
});

test('constructor validation invokes neither the constructor nor its prototype getter', async () => {
  let calls = 0; let prototypeReads = 0;
  const original = new Proxy(class { constructor() { calls++; } }, {
    get(target, key, receiver) { if (key === 'prototype') prototypeReads++; return Reflect.get(target, key, receiver); },
  });
  const source = DiBag.fromClass([], original);
  expect(calls).toBe(0); expect(prototypeReads).toBe(0);
  const bag = DiBag.createBuilder().register({ source }).build();
  bag.resolve('source');
  expect(calls).toBe(1); expect(prototypeReads).toBe(1);
  await bag.close();
});

test('function adapters pass positional values exactly and support explicitly bound receivers', async () => {
  const promiseKey = Symbol('promise'); const promised = DiBag.token(promiseKey).of<Promise<number>>();
  const pending = Promise.resolve(9);
  const receiver = { prefix: 'port:', format(this: { prefix: string }, value: number) { return this.prefix + value; } };
  const bag = DiBag.createBuilder().register(port, () => 80).register(promised, () => pending).register({
    source: DiBag.fromFunction([port, promised], function (this: void, value, promise) { return { receiver: this, value, promise }; }),
    bound: DiBag.fromFunction([port], receiver.format.bind(receiver)),
    empty: DiBag.fromFunction([], () => 'empty'),
  }).build();
  expect(bag.resolve('source')).toEqual({ receiver: undefined, value: 80, promise: pending });
  expect(bag.resolve('source').promise).toBe(pending);
  expect(bag.resolve('bound')).toBe('port:80'); expect(bag.resolve('empty')).toBe('empty');
  await bag.close();
});

test('optional and rest function and constructor arguments follow selected positions', async () => {
  class Optional { constructor(readonly first = 7, readonly second?: number) {} }
  class Rest { constructor(readonly first: number, ...rest: number[]) { this.rest = rest; } readonly rest: number[]; }
  const bag = DiBag.createBuilder().register(port, () => 4).register({
    optional: DiBag.fromClass([], Optional), rest: DiBag.fromClass([port, port, port], Rest),
    fn: DiBag.fromFunction([port, port], (first: number, ...rest: number[]) => first + rest.length),
    optionalFn: DiBag.fromFunction([], (value = 3) => value),
  }).build();
  expect(bag.resolve('optional')).toEqual({ first: 7, second: undefined });
  expect(bag.resolve('rest').rest).toEqual([4, 4]); expect(bag.resolve('fn')).toBe(5);
  expect(bag.resolve('optionalFn')).toBe(3); await bag.close();
});

for (const kind of ['function', 'class'] as const) {
  test(`${kind} adapters snapshot indexed tokens and ignore custom iterators`, async () => {
    const otherKey = Symbol('other'); const other = DiBag.token(otherKey).of<number>();
    const tokens: [typeof port, typeof other] = [port, other];
    let reads = 0;
    Object.defineProperty(tokens, 0, { get() { reads++; return port; }, configurable: true });
    tokens[Symbol.iterator] = function* () { throw new Error('iterator must not run'); };
    const source = kind === 'function' ? DiBag.fromFunction(tokens, (a, b) => ({ a, b }))
      : DiBag.fromClass(tokens, class { constructor(readonly a: number, readonly b: number) {} });
    Object.defineProperty(tokens, 0, { value: other }); tokens[1] = port as unknown as typeof other;
    const bag = DiBag.createBuilder().register(port, () => 1).register(other, () => 2).register({ source }).build();
    expect(bag.resolve('source')).toEqual({ a: 1, b: 2 }); expect(reads).toBe(1);
    await bag.close();
  });
  test(`${kind} adapters reject invalid declaration inputs before user effects`, () => {
    let calls = 0;
    const adapter = kind === 'function' ? DiBag.fromFunction : DiBag.fromClass;
    const callback = kind === 'function' ? () => { calls++; } : class { constructor() { calls++; } };
    for (const tokens of [null, {}, [undefined], [{ ...port }], [new Proxy(port, {})]]) {
      expect(() => Reflect.apply(adapter, undefined, [tokens, callback])).toThrow();
    }
    for (const options of [null, 1, { acquisitionMode: 'invalid' }]) {
      expect(() => Reflect.apply(adapter, undefined, [[], callback, options])).toThrow('acquisition');
    }
    const hostile = Object.defineProperty([], 0, { get() { throw new Error('token getter'); } });
    expect(() => Reflect.apply(adapter, undefined, [hostile, callback])).toThrow('token getter');
    for (const invalid of [null, {}, 1, ...(kind === 'class' ? [() => 1, async () => 1, function* () {}] : [])]) {
      expect(() => Reflect.apply(adapter, undefined, [[], invalid])).toThrow(kind === 'class' ? 'constructor' : 'function');
    }
    expect(calls).toBe(0);
  });
  test(`${kind} acquisition failures retry and disposal is explicit`, async () => {
    let calls = 0; let conventionalCleanup = 0; const disposed: unknown[] = [];
    class Resource {
      constructor() { if (++calls === 1) throw new Error('setup'); }
      close() { conventionalCleanup++; }
      dispose() { conventionalCleanup++; }
    }
    const source = kind === 'class' ? DiBag.fromClass([], Resource) : DiBag.fromFunction([], () => new Resource());
    const bag = DiBag.createBuilder().register({ owned: DiBag.withDisposal(source, value => { disposed.push(value); }), plain: source }).build();
    expect(() => bag.resolve('owned')).toThrow('setup');
    const value = bag.resolve('owned'); expect(value).toBeInstanceOf(Resource);
    bag.resolve('plain'); await bag.close();
    expect(calls).toBe(3); expect(disposed).toEqual([value]); expect(conventionalCleanup).toBe(0);
  });
}

test('raw and native adapters retain Promise identity and select the disposal value', async () => {
  const value = { id: 1 }; const promise = Promise.resolve(value); const disposed: unknown[] = [];
  const bag = Core.createBuilder().register({
    raw: Core.withDisposal(Core.fromFunction([], () => promise, { acquisitionMode: 'raw' }), result => { disposed.push(result); }),
    native: Core.withDisposal(Core.fromFunction([], () => promise, { acquisitionMode: 'nativePromise' }), result => { disposed.push(result); }),
  }).build();
  expect(bag.resolve('raw')).toBe(promise); expect(bag.resolve('native')).toBe(promise);
  await bag.close(); expect(disposed).toContain(promise); expect(disposed).toContain(value);
});

test('raw class adapters preserve thenables and auto rejects them without assimilation', async () => {
  let thenCalls = 0; const disposed: unknown[] = [];
  class Thenable { then() { thenCalls++; throw new Error('must not assimilate'); } }
  const bag = DiBag.createBuilder().register({
    raw: DiBag.withDisposal(DiBag.fromClass([], Thenable, { acquisitionMode: 'raw' }), value => { disposed.push(value); }),
    auto: DiBag.withDisposal(DiBag.fromClass([], Thenable), value => { disposed.push(value); }),
  }).build();
  const raw = bag.resolve('raw');
  expect(raw).toBeInstanceOf(Thenable); expect(() => bag.resolve('auto')).toThrow('Structural thenables');
  await bag.close(); expect(thenCalls).toBe(0); expect(disposed).toEqual([raw]);
});

test('automatic adapters require runtime classification before acquisition', () => {
  let calls = 0;
  expect(() => Core.createBuilder().register({ source: Core.fromFunction([], () => { calls++; return 1; }) }).build()).toThrow('classification');
  expect(() => Core.createBuilder().register({ source: Core.fromClass([], class { constructor() { calls++; } }) }).build()).toThrow('classification');
  expect(calls).toBe(0);
});

test('module token graphs and selected sharing keep ownership and parent dependencies', async () => {
  const disposed: unknown[] = [];
  const feature = DiBag.createModuleBuilder().register({ source: DiBag.withDisposal(DiBag.fromClass([port], Client), value => { disposed.push(value); }) }).buildModule(['source']);
  const bag = DiBag.createBuilder().register(port, () => 80).installModule(feature).build();
  const child = bag.createScope([port], { [portKey]: () => 90 }, { share: ['source'] });
  const shared = child.resolve('source'); expect(shared.port).toBe(80); expect(shared).toBe(bag.resolve('source'));
  expect(child.resolve(port)).toBe(90); await child.close(); expect(disposed).toEqual([]);
  const fork = bag.fork([port], { [portKey]: () => 99 }); expect(fork.resolve('source').port).toBe(99);
  await fork.close(); await bag.close(); expect(disposed).toHaveLength(2); expect(disposed).toContain(shared);
});

test('strict root class adapters retain root dependencies through child overrides', async () => {
  const bag = DiBag.createBuilder().register(port, DiBag.withLifetime(() => 80, 'root')).register({
    source: DiBag.withLifetime(DiBag.fromClass([port], Client), 'root'),
  }).build();
  const child = bag.createScope([port], { [portKey]: () => 90 });
  expect(child.resolve('source')).toBe(bag.resolve('source')); expect(child.resolve('source').port).toBe(80);
  await bag.close();
});


test('native class acquisition preserves constructed promises and disposes their fulfilled value', async () => {
  const disposed: unknown[] = [];
  class Promised extends Promise<number> {
    static get [Symbol.species]() { return Promise; }
    constructor() { super(resolve => resolve(7)); }
  }
  const bag = Core.createBuilder().register({
    source: Core.withDisposal(Core.fromClass([], Promised, { acquisitionMode: 'nativePromise' }), value => { disposed.push(value); }),
    raw: Core.withDisposal(Core.fromClass([], Promised, { acquisitionMode: 'raw' }), value => { disposed.push(value); }),
  }).build();
  const source = bag.resolve('source'); const raw = bag.resolve('raw');
  expect(source).toBeInstanceOf(Promised); expect(bag.resolve('source')).toBe(source);
  expect(raw).toBeInstanceOf(Promised); expect(await source).toBe(7);
  await bag.close(); expect(disposed).toContain(raw); expect(disposed).toContain(7);
});

test('rejected function acquisitions retry with the original Promise return', async () => {
  let calls = 0; let current: Promise<number> | undefined;
  const bag = DiBag.createBuilder().register({ source: DiBag.fromFunction([], () => {
    current = ++calls === 1 ? Promise.reject(new Error('retry')) : Promise.resolve(42); return current;
  }) }).build();
  const first = bag.resolve('source'); expect(current).toBe(first);
  await expect(first).rejects.toThrow('retry'); await Promise.resolve();
  const second = bag.resolve('source'); expect(current).toBe(second); expect(second).not.toBe(first);
  expect(await second).toBe(42); expect(calls).toBe(2); await bag.close();
});

test('constructor proxies retain their acquisition trap and original new.target', async () => {
  let traps = 0; let seen: unknown;
  const original = new Proxy(Client, { construct(target, args, newTarget) {
    traps++; seen = newTarget; return Reflect.construct(target, args, newTarget);
  } });
  const source = DiBag.fromClass([port], original);
  expect(traps).toBe(0);
  const bag = DiBag.createBuilder().register(port, () => 80).register({ source }).build();
  expect(bag.resolve('source').read()).toBe(80); expect(traps).toBe(1); expect(seen).toBe(original);
  expect(bag.resolve('source').target).toBe(original); await bag.close();
});
