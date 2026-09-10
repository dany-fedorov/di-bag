import { expect, test } from 'bun:test';
import { DiBag } from '../src/node';
import { DiBag as Portable } from '../src';

test('named aliases preserve exact canonical object and immutable history', async () => {
  let calls = 0;
  const initial = DiBag.createBuilder().register({ value: () => ({ id: ++calls }) });
  const bag = initial.alias('copy', 'value').alias('chain', 'copy').build();
  expect(bag.resolve('copy')).toBe(bag.resolve('value'));
  expect(bag.resolve('chain')).toBe(bag.resolve('value'));
  expect(bag.resolve('copy')).toEqual({ id: 1 });
  expect(() => initial.build().resolve('copy' as never)).toThrow('is not registered');
  await bag.close();
});

test('all token and name combinations and forward token requirements route identically', async () => {
  const aKey = Symbol('a'); const bKey = Symbol('b'); const cKey = Symbol('c');
  const a = DiBag.token(aKey).of<{ id: number }>();
  const b = DiBag.token(bKey).of<{ id: number }>();
  const c = DiBag.token(cKey).of<{ id: number }>();
  const bag = DiBag.createBuilder().alias('forward', a).alias(b, a).register({ value: () => ({ id: 1, extra: true }) }).alias(c, 'value').register(a, () => ({ id: 2 })).build();
  expect(bag.resolve('forward')).toBe(bag.resolve(a));
  expect(bag.resolve(b)).toBe(bag.resolve(a));
  expect(bag.resolve(c)).toBe(bag.resolve('value'));
  await bag.close();
});

test('aliases preserve explicit raw and native promises without classification', async () => {
  const pending = Promise.resolve({ id: 1 });
  const raw = Portable.createBuilder().register({ value: Portable.fromFactory(() => pending, { acquisitionMode: 'raw' }) }).alias('copy', 'value').build();
  const native = Portable.createBuilder().register({ value: Portable.fromFactory(() => pending, { acquisitionMode: 'nativePromise' }) }).alias('copy', 'value').build();
  expect(raw.resolve('copy')).toBe(pending);
  expect(native.resolve('copy')).toBe(pending);
  await raw.close(); await native.close();
});

test('transient aliases add no ownership and record actual target disposal edges', async () => {
  let calls = 0; const disposed: string[] = [];
  const bag = DiBag.createBuilder().register({
    value: DiBag.withLifetime(DiBag.withDisposal(() => ({ id: ++calls }), v => { disposed.push(`value:${v.id}`); }), 'transient'),
  }).alias('copy', 'value').register({
    consumer: DiBag.withDisposal(({ copy }: { copy: { id: number } }) => ({ copy }), () => { disposed.push('consumer'); }),
  }).build();
  expect(bag.resolve('consumer').copy.id).toBe(1);
  expect(bag.resolve('copy').id).toBe(2);
  expect(bag.resolve('value').id).toBe(3);
  expect(bag.inspect('copy').acquisitions).toHaveLength(3);
  expect(bag.inspect('copy').acquisitions).toEqual(bag.inspect('value').acquisitions);
  await bag.close();
  expect(disposed.filter(v => v === 'value:1')).toHaveLength(1);
  expect(disposed.indexOf('consumer')).toBeLessThan(disposed.indexOf('value:1'));
});

test('module aliases retain private targets and export renames under host collisions', async () => {
  const module = DiBag.createModuleBuilder().register({ value: () => ({ id: 'private' }) }).alias('copy', 'value').buildModule(['copy']).renameExport('copy', 'public');
  const bag = DiBag.createBuilder().register({ value: () => ({ id: 'host' }) }).installModule(module).build();
  expect(bag.resolve('public')).toEqual({ id: 'private' });
  expect(bag.resolve('value')).toEqual({ id: 'host' });
  const child = bag.createScope(['value'], { value: () => ({ id: 'child' }) });
  expect(child.resolve('public')).toEqual({ id: 'private' });
  expect(child.resolve('public')).not.toBe(bag.resolve('public'));
  await bag.close();
});

test('selected sharing routes alias through parent graph while independent overrides follow child graph', async () => {
  const bag = DiBag.createBuilder().register({ value: () => ({ id: 1 }) }).alias('copy', 'value').build();
  const child = bag.createScope(['value'], { value: () => ({ id: 2 }) });
  expect(child.resolve('copy')).toBe(child.resolve('value'));
  const shared = bag.createScope(['value'], { value: () => ({ id: 3 }) }, { share: ['copy'] });
  expect(shared.resolve('copy')).toBe(bag.resolve('value'));
  expect(shared.resolve('value').id).toBe(3);
  const replaced = bag.createScope(['copy'], { copy: () => ({ id: 4 }) });
  expect(replaced.resolve('copy').id).toBe(4);
  expect(replaced.resolve('value').id).toBe(1);
  const fork = bag.fork();
  expect(fork.resolve('copy')).toBe(fork.resolve('value'));
  expect(fork.resolve('copy')).not.toBe(bag.resolve('value'));
  await fork.close(); await bag.close();
});

test('runtime rejects transient sharing and root captures through aliases before invoking target', async () => {
  let calls = 0;
  const bag = DiBag.createBuilder().register({ value: DiBag.withLifetime(() => ++calls, 'transient') }).alias('copy', 'value').build();
  expect(() => Reflect.apply(bag.createScope, bag, [{ share: ['copy'] }])).toThrow('cannot share transient');
  const builder = DiBag.createBuilder().register({ value: () => ++calls }).alias('copy', 'value').register({
    root: DiBag.withLifetime(({ copy }: { copy: number }) => copy, 'root'),
  });
  const invalid = Reflect.apply(builder.build, builder, []);
  expect(() => invalid.resolve('root')).toThrow('root lifetime cannot capture scoped');
  expect(calls).toBe(0);
  await invalid.close(); await bag.close();
});

test('alias inspection reports direct target and canonical attempts without stale target metadata', async () => {
  const builder = DiBag.createBuilder().register({ value: DiBag.withMetadata(() => 1, { static: { old: true } }) }).alias('copy', 'value').alias('chain', 'copy');
  const bag = builder.replace('value', () => 2).build();
  expect(bag.inspect('chain').aliasTarget).toEqual({ bindingId: bag.inspect('copy').bindingId, label: 'copy' });
  expect(bag.inspect('copy').registrationMetadata).toEqual({});
  expect(Object.isFrozen(bag.inspect('chain').aliasTarget)).toBe(true);
  bag.resolve('chain');
  expect(bag.inspect('chain').acquisitions).toEqual(bag.inspect('value').acquisitions);
  await bag.close();
});

test('alias cycles retain a useful lexical path', async () => {
  const aKey = Symbol('a'); const bKey = Symbol('b');
  const a = DiBag.token(aKey).of<number>(); const b = DiBag.token(bKey).of<number>();
  const bag = DiBag.createBuilder().alias(a, b).alias(b, a).build();
  expect(() => bag.resolve(a)).toThrow(/cycle:.*Symbol\(a\).*Symbol\(b\).*Symbol\(a\)/);
  await bag.close();
});

test('runtime rejects invalid alias selections without changing the builder', () => {
  const builder = DiBag.createBuilder().register({ value: () => 1 });
  const alias = (...args: unknown[]) => Reflect.apply(builder.alias, builder, args);
  expect(() => alias('value', 'value')).toThrow('duplicate registration');
  expect(() => alias('copy', 'missing')).toThrow('existing');
  expect(() => alias(Symbol('fake'), 'value')).toThrow('invalid token');
  expect(() => alias('copy', { key: Symbol('fake') })).toThrow('invalid token');
  expect(builder.alias('copy', 'value').build().resolve('copy')).toBe(1);
});

test('startup through an alias waits for final readiness and retries failed canonical acquisitions', async () => {
  let ready!: () => void;
  const pending = new Promise<void>(resolve => { ready = resolve; });
  let started = false;
  const start = DiBag.createBuilder().register({ value: async () => { await pending; return 1; } }).alias('copy', 'value').buildAndStart(['copy']).then(bag => { started = true; return bag; });
  await Promise.resolve(); expect(started).toBe(false);
  ready(); const bag = await start;
  expect(await bag.resolve('copy')).toBe(1);
  expect(bag.resolve('copy')).toBe(bag.resolve('value'));
  await bag.close();
  let attempts = 0;
  const retry = DiBag.createBuilder().register({ value: async () => { if (++attempts === 1) throw new Error('retry'); return 2; } }).alias('copy', 'value').build();
  await expect(retry.resolve('copy')).rejects.toThrow('retry');
  expect(await retry.resolve('value')).toBe(2);
  expect(retry.resolve('copy')).toBe(retry.resolve('value'));
  await retry.close();
});

test('shared alias inspection identifies its parent target despite a child override', async () => {
  const bag = DiBag.createBuilder().register({ value: () => ({ id: 1 }) }).alias('copy', 'value').build();
  const child = bag.createScope(['value'], { value: () => ({ id: 2 }) }, { share: ['copy'] });
  child.resolve('copy');
  expect(child.inspect('copy').aliasTarget?.bindingId).toBe(bag.inspect('value').bindingId);
  expect(child.inspect('copy').aliasTarget?.bindingId).not.toBe(child.inspect('value').bindingId);
  expect(child.inspect('copy').acquisitions).toEqual(bag.inspect('value').acquisitions);
  await bag.close();
});

test('aliases of root targets retain the root graph under child overrides', async () => {
  const bag = DiBag.createBuilder().register({ value: DiBag.withLifetime(() => ({ id: 1 }), 'root') }).alias('copy', 'value').build();
  const child = bag.createScope();
  expect(child.resolve('copy')).toBe(bag.resolve('value'));
  const override = bag.createScope(['value'], { value: () => ({ id: 2 }) });
  expect(override.resolve('copy')).toBe(override.resolve('value'));
  expect(override.resolve('copy').id).toBe(2);
  await bag.close();
});

test('in-flight sources may read aliases while closing and retained reads close with the canonical owner', async () => {
  let resume!: () => void;
  const gate = new Promise<void>(resolve => { resume = resolve; });
  let retained!: () => number;
  const events: string[] = [];
  const bag = DiBag.createBuilder().register({ value: DiBag.withDisposal(() => 7, () => { events.push('value'); }) }).alias('copy', 'value').register({
    consumer: DiBag.withDisposal(async (deps: { copy: number }) => { retained = () => deps.copy; await gate; return deps.copy; }, () => { events.push('consumer'); }),
  }).build();
  const value = bag.resolve('consumer');
  const closing = bag.close(); resume();
  expect(await value).toBe(7); await closing;
  expect(events).toEqual(['consumer', 'value']);
  expect(() => retained()).toThrow('bag is closed');
});

test('module token aliases preserve private identity and external host requirements', async () => {
  const key = Symbol('private'); const token = DiBag.token(key).of<{ id: number }>();
  const privateModule = DiBag.createModuleBuilder().register(token, () => ({ id: 1 })).alias('copy', token).buildModule(['copy']);
  const bag = DiBag.createBuilder().register(token, () => ({ id: 2 })).installModule(privateModule).build();
  expect(bag.resolve('copy').id).toBe(1);
  expect(bag.resolve(token).id).toBe(2);
  const externalModule = DiBag.createModuleBuilder().alias('external', token).buildModule(['external']);
  const external = DiBag.createBuilder().installModule(externalModule).register(token, () => ({ id: 3 })).build();
  expect(external.resolve('external')).toBe(external.resolve(token));
  await bag.close(); await external.close();
});

test('exported target replacements and renames remain visible through module aliases', async () => {
  const module = DiBag.createModuleBuilder().register({ value: () => ({ id: 1 }) }).alias('copy', 'value').buildModule(['value', 'copy']).renameExport('value', 'renamed');
  const bag = DiBag.createBuilder().installModule(module).replace('renamed', () => ({ id: 2 })).build();
  expect(bag.resolve('copy')).toBe(bag.resolve('renamed'));
  expect(bag.resolve('copy').id).toBe(2);
  const child = bag.createScope(['renamed'], { renamed: () => ({ id: 3 }) });
  expect(child.resolve('copy')).toBe(child.resolve('renamed'));
  expect(child.resolve('copy').id).toBe(3);
  await bag.close();
});

test('re-sharing aliases keeps parent policy while fresh grandchildren and forks use local targets', async () => {
  const base = DiBag.createBuilder().register({ value: DiBag.withLifetime(() => ({ id: 1 }), 'root') }).alias('copy', 'value').build();
  const shared = base.createScope(['value'], { value: DiBag.withLifetime(() => ({ id: 2 }), 'transient') }, { share: ['copy'] });
  const borrowed = shared.createScope({ share: ['copy'] });
  expect(borrowed.resolve('copy')).toBe(base.resolve('value'));
  expect(borrowed.inspect('copy').aliasTarget?.bindingId).toBe(base.inspect('value').bindingId);
  const fresh = shared.createScope(); const fork = shared.fork();
  expect(fresh.resolve('copy').id).toBe(2);
  expect(fork.resolve('copy').id).toBe(2);
  expect(fresh.resolve('copy')).not.toBe(fresh.resolve('copy'));
  expect(() => Reflect.apply(fresh.createScope, fresh, [{ share: ['copy'] }])).toThrow('cannot share transient');
  expect(() => Reflect.apply(fork.createScope, fork, [{ share: ['copy'] }])).toThrow('cannot share transient');
  await fork.close(); await base.close();
});

test('strict roots use the effective shared alias policy in both lifetime directions', async () => {
  for (const rootTarget of [false, true]) {
    const source = () => ({ id: 1 });
    const initial = DiBag.createBuilder().register({ value: rootTarget ? DiBag.withLifetime(source, 'root') : source,
      consumer: ({ copy }: { copy: { id: number } }) => copy }).alias('copy', 'value').build();
    const override = () => ({ id: 2 });
    const child = initial.createScope(['value'], { value: rootTarget ? override : DiBag.withLifetime(override, 'root') }, { share: ['copy'] });
    const consumer = DiBag.withLifetime(({ copy }: { copy: { id: number } }) => copy, 'root');
    const shared = Reflect.apply(child.createScope, child, [['consumer'], { consumer }, { share: ['copy'] }]);
    const fresh = Reflect.apply(child.createScope, child, [['consumer'], { consumer }]);
    const fork = Reflect.apply(child.fork, child, [['consumer'], { consumer }]);
    if (rootTarget) {
      expect(shared.resolve('consumer')).toBe(initial.resolve('value'));
      expect(() => fresh.resolve('consumer')).toThrow('root lifetime cannot capture scoped');
      expect(() => fork.resolve('consumer')).toThrow('root lifetime cannot capture scoped');
    } else {
      expect(() => shared.resolve('consumer')).toThrow('root lifetime cannot capture scoped');
      expect(fresh.resolve('consumer')).toEqual({ id: 2 });
      expect(fork.resolve('consumer')).toEqual({ id: 2 });
    }
    await fork.close(); await initial.close();
  }
});

test('raw aliases do not inspect then getters or add cancellation contexts', async () => {
  let thenReads = 0; let contexts = 0; let signal!: AbortSignal;
  const value = { get then() { ++thenReads; throw new Error('do not assimilate'); } };
  const bag = Portable.createBuilder().register({ value: Portable.fromFactory((_deps: {}, context) => {
    contexts++; signal = context.signal; return value;
  }, { context: 'acquisition', ...{ acquisitionMode: 'raw' } }) }).alias('copy', 'value').build();
  expect(bag.resolve('copy')).toBe(value);
  expect(bag.resolve('value')).toBe(value);
  expect(contexts).toBe(1); expect(thenReads).toBe(0);
  await bag.close();
  expect(signal.aborted).toBe(true); expect(thenReads).toBe(0);
});
