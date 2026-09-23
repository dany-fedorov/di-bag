import { expect, test } from 'bun:test';
import { DiBag } from '../src';
import { DiBag as Portable } from '../src';

test('named aliases preserve exact canonical object and immutable history', async () => {
  let calls = 0;
  const initial = DiBag.createBuilder().withServices({ value: () => ({ id: ++calls }) });
  const bag = initial.withServiceAlias({ aliasKey: 'copy', targetServiceKey: 'value' }).withServiceAlias({ aliasKey: 'chain', targetServiceKey: 'copy' }).buildContainer();
  expect(bag.resolve('copy')).toBe(bag.resolve('value'));
  expect(bag.resolve('chain')).toBe(bag.resolve('value'));
  expect(bag.resolve('copy')).toEqual({ id: 1 });
  expect(() => initial.buildContainer().resolve('copy' as never)).toThrow('is not registered');
  await bag.close();
});

test('all token and name combinations and forward token requirements route identically', async () => {
  const aKey = Symbol('a'); const bKey = Symbol('b'); const cKey = Symbol('c');
  const a = DiBag.createToken(aKey).forService<{ id: number }>();
  const b = DiBag.createToken(bKey).forService<{ id: number }>();
  const c = DiBag.createToken(cKey).forService<{ id: number }>();
  const bag = DiBag.createBuilder().withServiceAlias({ aliasKey: 'forward', targetServiceKey: a }).withServiceAlias({ aliasKey: b, targetServiceKey: a }).withServices({ value: () => ({ id: 1, extra: true }) }).withServiceAlias({ aliasKey: c, targetServiceKey: 'value' }).withTokenService(a, () => ({ id: 2 })).buildContainer();
  expect(bag.resolve('forward')).toBe(bag.resolve(a));
  expect(bag.resolve(b)).toBe(bag.resolve(a));
  expect(bag.resolve(c)).toBe(bag.resolve('value'));
  await bag.close();
});

test('aliases preserve explicit raw and native promises without classification', async () => {
  const pending = Promise.resolve({ id: 1 });
  const raw = Portable.createBuilder().withServices({ value: Portable.createProvider(() => pending, { factoryReturnKind: 'uninspected' }) }).withServiceAlias({ aliasKey: 'copy', targetServiceKey: 'value' }).buildContainer();
  const native = Portable.createBuilder().withServices({ value: Portable.createProvider(() => pending, { factoryReturnKind: 'native-promise' }) }).withServiceAlias({ aliasKey: 'copy', targetServiceKey: 'value' }).buildContainer();
  expect(raw.resolve('copy')).toBe(pending);
  expect(native.resolve('copy')).toBe(pending);
  await raw.close(); await native.close();
});

test('transient aliases add no ownership and record actual target disposal edges', async () => {
  let calls = 0; const disposed: string[] = [];
  const bag = DiBag.createBuilder().withServices({
    value: DiBag.withLifetime(DiBag.withDisposal(() => ({ id: ++calls }), v => { disposed.push(`value:${v.id}`); }), 'transient'),
  }).withServiceAlias({ aliasKey: 'copy', targetServiceKey: 'value' }).withServices({
    consumer: DiBag.withDisposal(({ copy }: { copy: { id: number } }) => ({ copy }), () => { disposed.push('consumer'); }),
  }).buildContainer();
  expect(bag.resolve('consumer').copy.id).toBe(1);
  expect(bag.resolve('copy').id).toBe(2);
  expect(bag.resolve('value').id).toBe(3);
  expect(bag.serviceSnapshot('copy').acquisitions).toHaveLength(3);
  expect(bag.serviceSnapshot('copy').acquisitions).toEqual(bag.serviceSnapshot('value').acquisitions);
  await bag.close();
  expect(disposed.filter(v => v === 'value:1')).toHaveLength(1);
  expect(disposed.indexOf('consumer')).toBeLessThan(disposed.indexOf('value:1'));
});

test('module aliases retain private targets and export renames under host collisions', async () => {
  const module = DiBag.createBuilder().withServices({ value: () => ({ id: 'private' }) }).withServiceAlias({ aliasKey: 'copy', targetServiceKey: 'value' }).buildModule({ exportedServiceKeys: ['copy'] }).withRenamedExport({ currentExportKey: 'copy', newExportKey: 'public' });
  const bag = DiBag.createBuilder().withServices({ value: () => ({ id: 'host' }) }).withInstalledModules([module]).buildContainer();
  expect(bag.resolve('public')).toEqual({ id: 'private' });
  expect(bag.resolve('value')).toEqual({ id: 'host' });
  const child = bag.createChildContainer(['value'], { value: () => ({ id: 'child' }) });
  expect(child.resolve('public')).toEqual({ id: 'private' });
  expect(child.resolve('public')).not.toBe(bag.resolve('public'));
  await bag.close();
});

test('selected sharing routes alias through parent graph while independent overrides follow child graph', async () => {
  const bag = DiBag.createBuilder().withServices({ value: () => ({ id: 1 }) }).withServiceAlias({ aliasKey: 'copy', targetServiceKey: 'value' }).buildContainer();
  const child = bag.createChildContainer(['value'], { value: () => ({ id: 2 }) });
  expect(child.resolve('copy')).toBe(child.resolve('value'));
  const shared = bag.createChildContainer(['value'], { value: () => ({ id: 3 }) }, { sharedParentServiceKeys: ['copy'] });
  expect(shared.resolve('copy')).toBe(bag.resolve('value'));
  expect(shared.resolve('value').id).toBe(3);
  const replaced = bag.createChildContainer(['copy'], { copy: () => ({ id: 4 }) });
  expect(replaced.resolve('copy').id).toBe(4);
  expect(replaced.resolve('value').id).toBe(1);
  const fork = bag.createIndependentContainer();
  expect(fork.resolve('copy')).toBe(fork.resolve('value'));
  expect(fork.resolve('copy')).not.toBe(bag.resolve('value'));
  await fork.close(); await bag.close();
});

test('runtime rejects transient sharing and root captures through aliases before invoking target', async () => {
  let calls = 0;
  const bag = DiBag.createBuilder().withServices({ value: DiBag.withLifetime(() => ++calls, 'transient') }).withServiceAlias({ aliasKey: 'copy', targetServiceKey: 'value' }).buildContainer();
  expect(() => Reflect.apply(bag.createChildContainer, bag, [{ sharedParentServiceKeys: ['copy'] }])).toThrow('cannot share transient');
  const builder = DiBag.createBuilder().withServices({ value: () => ++calls }).withServiceAlias({ aliasKey: 'copy', targetServiceKey: 'value' }).withServices({
    root: DiBag.withLifetime(({ copy }: { copy: number }) => copy, 'root'),
  });
  const invalid = Reflect.apply(builder.buildContainer, builder, []);
  expect(() => invalid.resolve('root')).toThrow('root lifetime cannot capture scoped');
  expect(calls).toBe(0);
  await invalid.close(); await bag.close();
});

test('alias inspection reports direct target and canonical attempts without stale target metadata', async () => {
  const builder = DiBag.createBuilder().withServices({ value: DiBag.withMetadata(() => 1, { static: { old: true } }) }).withServiceAlias({ aliasKey: 'copy', targetServiceKey: 'value' }).withServiceAlias({ aliasKey: 'chain', targetServiceKey: 'copy' });
  const bag = builder.withReplacedService('value', () => 2).buildContainer();
  expect(bag.serviceSnapshot('chain').aliasTarget).toEqual({ bindingId: bag.serviceSnapshot('copy').bindingId, label: 'copy' });
  expect(bag.serviceSnapshot('copy').registrationMetadata).toEqual({});
  expect(Object.isFrozen(bag.serviceSnapshot('chain').aliasTarget)).toBe(true);
  bag.resolve('chain');
  expect(bag.serviceSnapshot('chain').acquisitions).toEqual(bag.serviceSnapshot('value').acquisitions);
  await bag.close();
});

test('alias cycles retain a useful lexical path', async () => {
  const aKey = Symbol('a'); const bKey = Symbol('b');
  const a = DiBag.createToken(aKey).forService<number>(); const b = DiBag.createToken(bKey).forService<number>();
  const bag = DiBag.createBuilder().withServiceAlias({ aliasKey: a, targetServiceKey: b }).withServiceAlias({ aliasKey: b, targetServiceKey: a }).buildContainer();
  expect(() => bag.resolve(a)).toThrow(/cycle:.*Symbol\(a\).*Symbol\(b\).*Symbol\(a\)/);
  await bag.close();
});

test('runtime rejects invalid alias selections without changing the builder', () => {
  const builder = DiBag.createBuilder().withServices({ value: () => 1 });
  const alias = (...args: unknown[]) => Reflect.apply(builder.withServiceAlias, builder, args);
  expect(() => alias({ aliasKey: 'value', targetServiceKey: 'value' })).toThrow('duplicate registration');
  expect(() => alias({ aliasKey: 'copy', targetServiceKey: 'missing' })).toThrow('existing');
  expect(() => alias({ aliasKey: Symbol('fake'), targetServiceKey: 'value' })).toThrow('invalid token');
  expect(() => alias({ aliasKey: 'copy', targetServiceKey: { key: Symbol('fake') } })).toThrow('invalid token');
  expect(builder.withServiceAlias({ aliasKey: 'copy', targetServiceKey: 'value' }).buildContainer().resolve('copy')).toBe(1);
});

test('startup through an alias waits for final readiness and retries failed canonical acquisitions', async () => {
  let ready!: () => void;
  const pending = new Promise<void>(resolve => { ready = resolve; });
  let started = false;
  const start = DiBag.createBuilder().withServices({ value: async () => { await pending; return 1; } }).withServiceAlias({ aliasKey: 'copy', targetServiceKey: 'value' }).buildContainer().ensureServicesReady(['copy']).then(bag => { started = true; return bag; });
  await Promise.resolve(); expect(started).toBe(false);
  ready(); const bag = await start;
  expect(await bag.resolve('copy')).toBe(1);
  expect(bag.resolve('copy')).toBe(bag.resolve('value'));
  await bag.close();
  let attempts = 0;
  const retry = DiBag.createBuilder().withServices({ value: async () => { if (++attempts === 1) throw new Error('retry'); return 2; } }).withServiceAlias({ aliasKey: 'copy', targetServiceKey: 'value' }).buildContainer();
  await expect(retry.resolve('copy')).rejects.toThrow('retry');
  expect(await retry.resolve('value')).toBe(2);
  expect(retry.resolve('copy')).toBe(retry.resolve('value'));
  await retry.close();
});

test('shared alias inspection identifies its parent target despite a child override', async () => {
  const bag = DiBag.createBuilder().withServices({ value: () => ({ id: 1 }) }).withServiceAlias({ aliasKey: 'copy', targetServiceKey: 'value' }).buildContainer();
  const child = bag.createChildContainer(['value'], { value: () => ({ id: 2 }) }, { sharedParentServiceKeys: ['copy'] });
  child.resolve('copy');
  expect(child.serviceSnapshot('copy').aliasTarget?.bindingId).toBe(bag.serviceSnapshot('value').bindingId);
  expect(child.serviceSnapshot('copy').aliasTarget?.bindingId).not.toBe(child.serviceSnapshot('value').bindingId);
  expect(child.serviceSnapshot('copy').acquisitions).toEqual(bag.serviceSnapshot('value').acquisitions);
  await bag.close();
});

test('aliases of root targets retain the root graph under child overrides', async () => {
  const bag = DiBag.createBuilder().withServices({ value: DiBag.withLifetime(() => ({ id: 1 }), 'root') }).withServiceAlias({ aliasKey: 'copy', targetServiceKey: 'value' }).buildContainer();
  const child = bag.createChildContainer();
  expect(child.resolve('copy')).toBe(bag.resolve('value'));
  const override = bag.createChildContainer(['value'], { value: () => ({ id: 2 }) });
  expect(override.resolve('copy')).toBe(override.resolve('value'));
  expect(override.resolve('copy').id).toBe(2);
  await bag.close();
});

test('in-flight sources may read aliases while closing and retained reads close with the canonical owner', async () => {
  let resume!: () => void;
  const gate = new Promise<void>(resolve => { resume = resolve; });
  let retained!: () => number;
  const events: string[] = [];
  const bag = DiBag.createBuilder().withServices({ value: DiBag.withDisposal(() => 7, () => { events.push('value'); }) }).withServiceAlias({ aliasKey: 'copy', targetServiceKey: 'value' }).withServices({
    consumer: DiBag.withDisposal(async (deps: { copy: number }) => { retained = () => deps.copy; await gate; return deps.copy; }, () => { events.push('consumer'); }),
  }).buildContainer();
  const value = bag.resolve('consumer');
  const closing = bag.close(); resume();
  expect(await value).toBe(7); await closing;
  expect(events).toEqual(['consumer', 'value']);
  expect(() => retained()).toThrow('bag is closed');
});

test('module token aliases preserve private identity and external host requirements', async () => {
  const key = Symbol('private'); const token = DiBag.createToken(key).forService<{ id: number }>();
  const privateModule = DiBag.createBuilder().withTokenService(token, () => ({ id: 1 })).withServiceAlias({ aliasKey: 'copy', targetServiceKey: token }).buildModule({ exportedServiceKeys: ['copy'] });
  const bag = DiBag.createBuilder().withTokenService(token, () => ({ id: 2 })).withInstalledModules([privateModule]).buildContainer();
  expect(bag.resolve('copy').id).toBe(1);
  expect(bag.resolve(token).id).toBe(2);
  const externalModule = DiBag.createBuilder().withServiceAlias({ aliasKey: 'external', targetServiceKey: token }).buildModule({ exportedServiceKeys: ['external'] });
  const external = DiBag.createBuilder().withInstalledModules([externalModule]).withTokenService(token, () => ({ id: 3 })).buildContainer();
  expect(external.resolve('external')).toBe(external.resolve(token));
  await bag.close(); await external.close();
});

test('exported target replacements and renames remain visible through module aliases', async () => {
  const module = DiBag.createBuilder().withServices({ value: () => ({ id: 1 }) }).withServiceAlias({ aliasKey: 'copy', targetServiceKey: 'value' }).buildModule({ exportedServiceKeys: ['value', 'copy'] }).withRenamedExport({ currentExportKey: 'value', newExportKey: 'renamed' });
  const bag = DiBag.createBuilder().withInstalledModules([module]).withReplacedService('renamed', () => ({ id: 2 })).buildContainer();
  expect(bag.resolve('copy')).toBe(bag.resolve('renamed'));
  expect(bag.resolve('copy').id).toBe(2);
  const child = bag.createChildContainer(['renamed'], { renamed: () => ({ id: 3 }) });
  expect(child.resolve('copy')).toBe(child.resolve('renamed'));
  expect(child.resolve('copy').id).toBe(3);
  await bag.close();
});

test('re-sharing aliases keeps parent policy while fresh grandchildren and forks use local targets', async () => {
  const base = DiBag.createBuilder().withServices({ value: DiBag.withLifetime(() => ({ id: 1 }), 'root') }).withServiceAlias({ aliasKey: 'copy', targetServiceKey: 'value' }).buildContainer();
  const shared = base.createChildContainer(['value'], { value: DiBag.withLifetime(() => ({ id: 2 }), 'transient') }, { sharedParentServiceKeys: ['copy'] });
  const borrowed = shared.createChildContainer({ sharedParentServiceKeys: ['copy'] });
  expect(borrowed.resolve('copy')).toBe(base.resolve('value'));
  expect(borrowed.serviceSnapshot('copy').aliasTarget?.bindingId).toBe(base.serviceSnapshot('value').bindingId);
  const fresh = shared.createChildContainer(); const fork = shared.createIndependentContainer();
  expect(fresh.resolve('copy').id).toBe(2);
  expect(fork.resolve('copy').id).toBe(2);
  expect(fresh.resolve('copy')).not.toBe(fresh.resolve('copy'));
  expect(() => Reflect.apply(fresh.createChildContainer, fresh, [{ sharedParentServiceKeys: ['copy'] }])).toThrow('cannot share transient');
  expect(() => Reflect.apply(fork.createChildContainer, fork, [{ sharedParentServiceKeys: ['copy'] }])).toThrow('cannot share transient');
  await fork.close(); await base.close();
});

test('strict roots use the effective shared alias policy in both lifetime directions', async () => {
  for (const rootTarget of [false, true]) {
    const source = () => ({ id: 1 });
    const initial = DiBag.createBuilder().withServices({ value: rootTarget ? DiBag.withLifetime(source, 'root') : source,
      consumer: ({ copy }: { copy: { id: number } }) => copy }).withServiceAlias({ aliasKey: 'copy', targetServiceKey: 'value' }).buildContainer();
    const override = () => ({ id: 2 });
    const child = initial.createChildContainer(['value'], { value: rootTarget ? override : DiBag.withLifetime(override, 'root') }, { sharedParentServiceKeys: ['copy'] });
    const consumer = DiBag.withLifetime(({ copy }: { copy: { id: number } }) => copy, 'root');
    const shared = Reflect.apply(child.createChildContainer, child, [['consumer'], { consumer }, { sharedParentServiceKeys: ['copy'] }]);
    const fresh = Reflect.apply(child.createChildContainer, child, [['consumer'], { consumer }]);
    const fork = Reflect.apply(child.createIndependentContainer, child, [['consumer'], { consumer }]);
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
  const bag = Portable.createBuilder().withServices({ value: Portable.createProvider((_deps: {}, context) => {
    contexts++; signal = context.abortSignal; return value;
  }, { factoryReceivesContext: true, ...{ factoryReturnKind: 'uninspected' as const } }) }).withServiceAlias({ aliasKey: 'copy', targetServiceKey: 'value' }).buildContainer();
  expect(bag.resolve('copy')).toBe(value);
  expect(bag.resolve('value')).toBe(value);
  expect(contexts).toBe(1); expect(thenReads).toBe(0);
  await bag.close();
  expect(signal.aborted).toBe(true); expect(thenReads).toBe(0);
});
