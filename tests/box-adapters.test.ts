import { expect, test } from 'bun:test';
import { DiBag, type Presence } from '../src/node';
import { fromSasBox } from '../src/sas-box';
import { fromValBox, fromValBoxAsync } from '../src/val-box';

test('mixed factory, owned and provider registrations map and unbox every valid branch', async () => {
  const plain = ({ dep }: { dep: boolean }) => ({
    sync: () => dep ? 42 : 0,
    snapshot: () => ({ value: { present: true as const, value: dep ? 42 : 0 }, metadata: { present: false as const }, alias: null }),
  });
  let disposals = 0;
  const owned = DiBag.withDisposal(plain, () => { disposals++; });
  const provider = DiBag.withMetadata(plain, { owner: 'source' });
  for (const source of [plain, owned, provider]) {
    const bag = DiBag.begin().add({
      dep: () => true,
      mapped: DiBag.mapSync(source, value => value.sync().toFixed()),
      mappedAsync: DiBag.mapAsync(source, value => value.sync() + 1),
      sas: fromSasBox(source, { mode: 'sync' }),
      val: fromValBox(source),
      presence: fromValBox(source, { value: 'presence' }),
      valAsync: fromValBoxAsync(source),
      presenceAsync: fromValBoxAsync(source, { value: 'presence' }),
    }).end();
    expect(bag.resolve('mapped')).toBe('42');
    expect(await bag.resolve('mappedAsync')).toBe(43);
    expect(bag.resolve('sas')).toBe(42);
    expect(bag.resolve('val')).toBe(42);
    expect(bag.resolve('presence')).toEqual({ present: true, value: 42 });
    expect(await bag.resolve('valAsync')).toBe(42);
    expect(await bag.resolve('presenceAsync')).toEqual({ present: true, value: 42 });
    await bag.close();
  }
  expect(disposals).toBe(7);
});

const snapshot = <V, M>(value: Presence<V>, metadata: Presence<M>, alias: string | null = null) => ({ value, metadata, alias });
const box = <V, M>(value: Presence<V>, metadata: Presence<M>, alias: string | null = null) => ({ snapshot: () => snapshot(value, metadata, alias) });

test('sas modes select capabilities, preserve receiver and cache once per acquisition', async () => {
  const calls: string[] = [];
  const raw = { value: 42, sync() { calls.push('sync'); return this.value; }, async() { calls.push('async'); return Promise.resolve(String(this.value)); } };
  const bag = DiBag.begin().add({
    sync: fromSasBox(() => raw, { mode: 'sync' }),
    async: fromSasBox(async () => raw, { mode: 'async' }),
    first: fromSasBox(async () => raw, { mode: 'sync-first' }),
    fallback: fromSasBox(() => ({ sync: undefined, async: async () => 7 }), { mode: 'sync-first' }),
  }).end();
  expect(bag.resolve('sync')).toBe(42);
  expect(bag.resolve('sync')).toBe(42);
  expect(await bag.resolve('async')).toBe('42');
  expect(await bag.resolve('first')).toBe(42);
  expect(await bag.resolve('fallback')).toBe(7);
  expect(calls).toEqual(['sync', 'async', 'sync']);
  const fork = bag.fork();
  expect(fork.resolve('sync')).toBe(42);
  expect(calls).toEqual(['sync', 'async', 'sync', 'sync']);
  await fork.close(); await bag.close();
});

test('sas sync preserves a raw promise while asynchronous routes return native promises', async () => {
  const raw = Promise.resolve(4);
  const bag = DiBag.begin().add({
    sync: fromSasBox(() => ({ sync: () => raw }), { mode: 'sync' }),
    first: fromSasBox(() => ({ sync: () => raw }), { mode: 'sync-first' }),
    async: fromSasBox(() => ({ async: () => 5 }), { mode: 'async' }),
  }).end();
  expect(bag.resolve('sync')).toBe(raw);
  expect(bag.resolve('first')).toBeInstanceOf(Promise);
  expect(bag.resolve('first')).not.toBe(raw);
  expect(await bag.resolve('first')).toBe(4);
  expect(bag.resolve('async')).toBeInstanceOf(Promise);
  expect(await bag.resolve('async')).toBe(5);
  await bag.close();
});

test('sas callback throws preserve error identity and clean only the owned raw box', async () => {
  const error = new Error('callback');
  const disposed: unknown[] = [];
  const raw = { sync() { throw error; }, async() { throw error; } };
  const bag = DiBag.begin().add({
    sync: fromSasBox(DiBag.withDisposal(() => raw, value => { disposed.push(value); }), { mode: 'sync' }),
    async: fromSasBox(DiBag.withDisposal(() => raw, value => { disposed.push(value); }), { mode: 'async' }),
  }).end();
  expect(() => bag.resolve('sync')).toThrow(error);
  expect(await bag.resolve('async').catch(cause => cause)).toBe(error);
  await bag.close();
  expect(disposed).toEqual([raw, raw]);
});

test('val metadata captures presence and alias without owning payload, and separates outer ownership', async () => {
  const payload = { read: () => 42 };
  const metadata = { owner: 'platform' };
  const events: unknown[] = [];
  let calls = 0;
  const raw = { payload, snapshot() { calls++; return snapshot({ present: true, value: this.payload }, { present: true, value: metadata }, 'db'); } };
  const registration = fromValBox(DiBag.withDisposal(() => raw, value => { events.push(value); }));
  const bag = DiBag.begin().add({ service: DiBag.withDisposal(registration, value => { events.push(value); }) }).end();
  expect(bag.resolve('service')).toBe(payload);
  expect(bag.resolve('service')).toBe(payload);
  expect(calls).toBe(1);
  const frame = bag.inspect('service').acquisitions[0]!.metadata[0];
  expect(frame.present).toBe(true);
  if (frame.present) {
    expect(frame.value.alias).toBe('db');
    expect(frame.value.kind).toBe('val-box');
    expect(frame.value.metadata).toEqual({ present: true, value: metadata });
    if (frame.value.metadata.present) expect(frame.value.metadata.value).toBe(metadata);
    expect(Object.isFrozen(frame)).toBe(true);
    expect(Object.isFrozen(frame.value)).toBe(true);
    expect(Object.isFrozen(frame.value.metadata)).toBe(true);
    expect(Object.isFrozen(metadata)).toBe(false);
  }
  await bag.close();
  expect(events).toEqual([payload, raw]);
});

test('val presence distinguishes absence and present undefined and preserves empty aliases', async () => {
  const bag = DiBag.begin().add({
    absent: fromValBox(() => box({ present: false }, { present: false }), { value: 'presence' }),
    undefined: fromValBox(() => box({ present: true, value: undefined }, { present: true, value: undefined }, '')),
    optional: fromValBoxAsync(async () => box({ present: true, value: undefined }, { present: false }), { value: 'presence' }),
  }).end();
  expect(bag.resolve('absent')).toEqual({ present: false });
  expect(bag.resolve('undefined')).toBeUndefined();
  expect(await bag.resolve('optional')).toEqual({ present: true, value: undefined });
  expect(bag.inspect('absent').acquisitions[0]!.metadata[0]).toEqual({ present: true, value: { kind: 'val-box', metadata: { present: false }, alias: null } });
  expect(bag.inspect('undefined').acquisitions[0]!.metadata[0]).toEqual({ present: true, value: { kind: 'val-box', metadata: { present: true, value: undefined }, alias: '' } });
  await bag.close();
});

test('val copies snapshots once and retains nested frames through other transforms', async () => {
  const meta = { count: 1 };
  const mutable = { value: { present: true as const, value: 42 }, metadata: { present: true as const, value: meta }, alias: 'inner' };
  const inner = { snapshot() { return mutable; } };
  const outer = box({ present: true, value: inner }, { present: false }, 'outer');
  const registration = DiBag.withMetadata(DiBag.mapSync(fromValBox(fromValBox(() => outer)), value => value + 1), { owner: 'test' });
  const bag = DiBag.begin().add({ value: registration }).end();
  expect(bag.resolve('value')).toBe(43);
  const before = bag.inspect('value');
  mutable.alias = 'changed'; mutable.metadata.value = { count: 2 }; mutable.value.value = 99;
  expect(bag.inspect('value').acquisitions[0]!.metadata).toEqual([
    { present: true, value: { kind: 'val-box', metadata: { present: false }, alias: 'outer' } },
    { present: true, value: { kind: 'val-box', metadata: { present: true, value: meta }, alias: 'inner' } },
  ]);
  expect(bag.inspect('value').acquisitions[0]!.metadata).not.toBe(before.acquisitions[0]!.metadata);
  expect(Object.isFrozen(before.acquisitions[0]!.metadata)).toBe(true);
  expect(before.metadata).toEqual({ owner: 'test' });
  await bag.close();
});

test('val frames exist as absent inside the source factory and remain snapshot-isolated while pending', async () => {
  let finish!: (value: ReturnType<typeof sourceBox>) => void;
  const sourceBox = () => box({ present: true, value: box({ present: true, value: 7 }, { present: false }) }, { present: false });
  let during: unknown;
  const bag = DiBag.begin().add({
    value: fromValBoxAsync(fromValBoxAsync(() => {
      during = bag.inspect('value').acquisitions[0]!.metadata;
      return new Promise<ReturnType<typeof sourceBox>>(resolve => { finish = resolve; });
    })),
  }).end();
  const result = bag.resolve('value');
  expect(during).toEqual([{ present: false }, { present: false }]);
  const pending = bag.inspect('value').acquisitions[0]!.metadata;
  expect(pending).toEqual([{ present: false }, { present: false }]);
  expect(Object.isFrozen(pending[0])).toBe(true);
  finish(sourceBox());
  expect(await result).toBe(7);
  expect(pending).toEqual([{ present: false }, { present: false }]);
  expect(bag.inspect('value').acquisitions[0]!.metadata.every(frame => frame.present)).toBe(true);
  await bag.close();
});

test('val absence and throwing snapshot/getters retire ownership with the original error', async () => {
  const error = new Error('snapshot');
  const disposed: unknown[] = [];
  const raw = { snapshot() { throw error; } };
  const getter = { get snapshot(): () => never { throw error; } };
  const absent = box({ present: false }, { present: false });
  const bag = DiBag.begin().add({
    thrown: fromValBox(DiBag.withDisposal(() => raw, value => { disposed.push(value); })),
    getter: fromValBoxAsync(DiBag.withDisposal(async () => getter, value => { disposed.push(value); })),
    absent: fromValBox(DiBag.withDisposal(() => absent, value => { disposed.push(value); })),
  }).end();
  expect(() => bag.resolve('thrown')).toThrow(error);
  expect(await bag.resolve('getter').catch(cause => cause)).toBe(error);
  expect(() => bag.resolve('absent')).toThrow('value is absent');
  await bag.close();
  expect(disposed).toHaveLength(3);
  expect(disposed).toContain(raw); expect(disposed).toContain(getter); expect(disposed).toContain(absent);
});

test('unchecked val snapshots validate every structural field without inspecting payloads', async () => {
  const invalid: unknown[] = [null, [], 1, {},
    { value: null, metadata: { present: false }, alias: null },
    { value: { present: 'yes', value: 1 }, metadata: { present: false }, alias: null },
    { value: { present: true }, metadata: { present: false }, alias: null },
    { value: { present: false }, metadata: {}, alias: null },
    { value: { present: false }, metadata: { present: true }, alias: null },
    { value: { present: false }, metadata: { present: false }, alias: undefined },
    { value: { present: false }, metadata: { present: false }, alias: 42 },
  ];
  for (const value of invalid) {
    // This cast tests the unchecked runtime boundary, not a compiler guarantee.
    const raw = { snapshot: () => value } as { snapshot(): { value: Presence<unknown>; metadata: Presence<unknown>; alias: string | null } };
    let disposed: unknown;
    const bag = DiBag.begin().add({ value: fromValBox(DiBag.withDisposal(() => raw, value => { disposed = value; }), { value: 'presence' }) }).end();
    expect(() => bag.resolve('value')).toThrow('invalid val-box snapshot');
    await bag.close();
    expect(disposed).toBe(raw);
  }
});

test('val preserves raw promise payloads synchronously and awaits only the explicit async boundary', async () => {
  const value = Promise.resolve(42);
  const raw = box({ present: true, value }, { present: false });
  const bag = DiBag.begin().add({
    sync: fromValBox(() => raw),
    async: fromValBoxAsync(() => raw),
    presence: fromValBoxAsync(() => raw, { value: 'presence' }),
  }).end();
  expect(bag.resolve('sync')).toBe(value);
  expect(bag.resolve('async')).not.toBe(value);
  expect(await bag.resolve('async')).toBe(42);
  const presence = await bag.resolve('presence');
  expect(presence.present).toBe(true);
  if (presence.present) expect(presence.value).toBe(value);
  await bag.close();
});

test('val propagates snapshot-field getter errors and never reads erased payload properties', async () => {
  const error = new Error('field getter');
  const payload = new Proxy({}, { get() { throw error; } });
  // Metadata payloads are never interpreted, even if they resemble capabilities.
  const safe = box({ present: true, value: 42 }, { present: true, value: payload });
  const raw = { snapshot() { return { get value(): Presence<number> { throw error; }, metadata: { present: false as const }, alias: null }; } };
  let disposed: unknown;
  const bag = DiBag.begin().add({ safe: fromValBox(() => safe),
    failed: fromValBox(DiBag.withDisposal(() => raw, value => { disposed = value; })) }).end();
  expect(bag.resolve('safe')).toBe(42);
  let caught: unknown;
  try { bag.resolve('failed'); } catch (cause) { caught = cause; }
  expect(caught).toBe(error);
  const frame = bag.inspect('safe').acquisitions[0]!.metadata[0];
  if (frame.present && frame.value.metadata.present) expect(frame.value.metadata.value).toBe(payload);
  await bag.close(); expect(disposed).toBe(raw);
});

test('failed val unboxing abandons the caller edge while pending source ownership finishes', async () => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const events: string[] = [];
  let pending: Promise<string> | undefined;
  const empty = box({ present: false }, { present: false });
  const source = DiBag.withDisposal((deps: { parent: string }) => {
    pending = (async () => { await gate; return deps.parent; })();
    return pending;
  }, value => { events.push(value); });
  const bag = DiBag.begin().add({
    parent: (deps: { failed: unknown }) => {
      try { void deps.failed; } catch (cause) { expect(String(cause)).toContain('value is absent'); }
      return 'recovered parent';
    },
    failed: fromValBox(DiBag.mapSync(source, () => empty)),
  }).end();
  expect(bag.resolve('parent')).toBe('recovered parent');
  const closing = bag.close(); release();
  expect(await pending).toBe('recovered parent');
  await closing;
  expect(events).toEqual(['recovered parent']);
});
