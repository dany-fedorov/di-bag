import { expect, test } from 'bun:test';
import { DiBag } from '../src';
import { transform } from '../src/provider';
import type { ProviderOperation } from '../src/provider-operations';

test('metadata is a snapshot and inspection never starts a factory', async () => {
  let calls = 0;
  const payload = { team: 'platform' };
  const input = { 'app:owner': payload };
  const provider = DiBag.withMetadata(() => { calls++; return { read: () => 42 }; }, input);
  const bag = DiBag.begin().add({ service: provider }).end();
  input['app:owner'] = { team: 'changed' };
  const before = bag.inspect('service');
  expect(calls).toBe(0);
  expect(before.metadata['app:owner']).toBe(payload);
  expect(before.acquisitions).toEqual([]);
  expect(Object.isFrozen(before.metadata)).toBe(true);
  expect(Object.isFrozen(payload)).toBe(false);
  expect(Object.isFrozen(provider)).toBe(true);
  expect(bag.resolve('service').read()).toBe(42);
  const after = bag.inspect('service');
  expect(after.bindingId).toBe(before.bindingId);
  expect(after.label).toBe('service');
  expect(after.acquisitions).toHaveLength(1);
  expect(after.acquisitions[0]?.state).toBe('ready');
  expect(after.acquisitions[0]?.metadata).toEqual([]);
  for (const value of [after, after.acquisitions, after.acquisitions[0], after.acquisitions[0]?.metadata]) {
    expect(Object.isFrozen(value)).toBe(true);
  }
  expect(Reflect.ownKeys(after)).toEqual(['bindingId', 'label', 'metadata', 'acquisitions']);
  expect(Reflect.ownKeys(after.acquisitions[0]!)).toEqual(['acquisitionId', 'state', 'metadata']);
  expect(before.acquisitions).toEqual([]);
  await bag.close();
  expect(bag.inspect('service').acquisitions).toEqual([]);
  expect(bag.inspect('service').metadata['app:owner']).toBe(payload);
  expect(after.acquisitions[0]?.state).toBe('ready');
});

test('metadata preflight sees hidden collisions before reading any getters', () => {
  const events: string[] = [];
  const initial = { owner: 'platform' };
  Object.defineProperty(initial, 'hidden', { value: 42 });
  const provider = DiBag.withMetadata(() => 1, initial);
  const more = {
    get fresh() { events.push('fresh'); return true; },
  };
  Object.defineProperty(more, 'hidden', { get() { events.push('hidden'); return 7; } });
  expect(() => DiBag.withMetadata(provider, more)).toThrow('duplicate metadata');
  expect(events).toEqual([]);
  const bag = DiBag.begin().add({ provider }).end();
  expect(Reflect.get(bag.inspect('provider').metadata, 'hidden')).toBe(42);
});

test('metadata additions preserve symbol keys and snapshot accessors once', () => {
  const key = Symbol('app:tag');
  const payload = { tag: 'active' };
  let reads = 0;
  const metadata = { get [key]() { reads++; return payload; } };
  const base = DiBag.withMetadata(() => 42, metadata);
  const extended = DiBag.withMetadata(base, { owner: 'platform' });
  const bag = DiBag.begin().add({ base, extended }).end();
  expect(reads).toBe(1);
  expect(bag.inspect('extended').metadata[key]).toBe(payload);
  expect(bag.inspect('base').metadata).not.toHaveProperty('owner');
  expect(Object.getOwnPropertyDescriptor(bag.inspect('extended').metadata, key)?.get).toBeUndefined();
});

test('runtime rejects copied and forged provider registrations', () => {
  const provider = DiBag.withMetadata(() => 42, { owner: 'platform' });
  const add = DiBag.begin().add.bind(DiBag.begin()) as (value: unknown) => unknown;
  expect(() => add({ service: { ...provider } })).toThrow('invalid factory registration');
  expect(() => add({ service: Object.create(Object.getPrototypeOf(provider)) })).toThrow('invalid factory registration');
});

test('inspection follows pending retries without retaining failed attempts or changing disposal', async () => {
  let reject!: (reason: unknown) => void;
  let accept!: (value: { id: number }) => void;
  const raw = { id: 42 };
  const first = new Promise<{ id: number }>((_, no) => { reject = no; });
  const second = new Promise<{ id: number }>(yes => { accept = yes; });
  let calls = 0;
  let disposed: unknown;
  const bag = DiBag.begin().add({ service: DiBag.withMetadata(DiBag.withDisposal(
    () => calls++ === 0 ? first : second,
    value => { disposed = value; expect(bag.inspect('service').acquisitions[0]?.state).toBe('disposing'); },
  ), { owner: 'platform' }) }).end();
  expect(bag.resolve('service')).toBe(first);
  const pending = bag.inspect('service');
  expect(pending.acquisitions[0]?.state).toBe('pending');
  reject(new Error('retry'));
  await first.catch(() => {});
  expect(bag.inspect('service').acquisitions).toEqual([]);
  expect(bag.resolve('service')).toBe(second);
  expect(bag.inspect('service').acquisitions[0]?.acquisitionId).not.toBe(pending.acquisitions[0]?.acquisitionId);
  accept(raw);
  await second;
  await bag.close();
  expect(disposed).toBe(raw);
  expect(bag.inspect('service').acquisitions).toEqual([]);
  expect(pending.acquisitions[0]?.state).toBe('pending');
});

test('module rename and fork keep metadata with the actual binding', async () => {
  const unit = DiBag.module().add({
    privateValue: () => 42,
    service: DiBag.withMetadata(({ privateValue }: { privateValue: number }) => privateValue, { owner: 'module' }),
  }).exports(['service']).rename('service', 'client');
  const bag = DiBag.begin().install(unit).end();
  const child = bag.fork(['client'], { client: DiBag.withMetadata(() => 7, { child: true }) });
  expect(bag.inspect('client').metadata.owner).toBe('module');
  expect(bag.inspect('client').acquisitions).toEqual([]);
  expect(child.inspect('client').metadata.child).toBe(true);
  expect(child.inspect('client').bindingId).not.toBe(bag.inspect('client').bindingId);
  expect(bag.resolve('client')).toBe(42);
  expect(child.resolve('client')).toBe(7);
  await Promise.all([bag.close(), child.close()]);
});

test('plain registrations expose empty metadata and frames, including creating snapshots', async () => {
  let creating: unknown;
  const bag = DiBag.begin().add({ service: () => { creating = bag.inspect('service').acquisitions[0]?.state; return 42; } }).end();
  expect(bag.inspect('service').metadata).toEqual({});
  expect(bag.resolve('service')).toBe(42);
  expect(creating).toBe('creating');
  expect(bag.inspect('service').acquisitions[0]?.metadata).toEqual([]);
  await bag.close();
});

test('metadata preserves synchronous ownership and borrowed cleanup methods', async () => {
  const raw = { id: 42 };
  const disposed: unknown[] = [];
  const borrowed = { close() { throw new Error('borrowed must not close'); } };
  const bag = DiBag.begin().add({
    owned: DiBag.withMetadata(DiBag.withDisposal(() => raw, value => { disposed.push(value); }), { owner: 'platform' }),
    borrowed: DiBag.withMetadata(() => borrowed, { owner: 'external' }),
  }).end();
  expect(bag.resolve('owned')).toBe(raw);
  expect(bag.resolve('borrowed')).toBe(borrowed);
  await bag.close();
  expect(disposed).toEqual([raw]);
  expect(disposed[0]).toBe(raw);
});
test('adapter execution captures projected values and acquisition frames', async () => {
  // Exercise the engine independently so missing public subpaths cannot mask RED.
  const operation: ProviderOperation = { kind: 'frame-sync', project: () => ({ value: 42, frame: Object.freeze({ kind: 'val-box', metadata: Object.freeze({ present: false }), alias: 'engine' }) }) };
  const registration = transform<() => object, () => number, readonly [unknown]>(() => ({}), operation);
  const bag = DiBag.begin().add({ value: registration }).end();
  expect(bag.resolve('value')).toBe(42);
  expect(bag.inspect('value').acquisitions[0]!.metadata).toEqual([
    { present: true, value: { kind: 'val-box', metadata: { present: false }, alias: 'engine' } },
  ]);
  await bag.close();
});
