import { expect, test } from 'bun:test';
import { DiBag } from '../src/node';
import { transform } from '../src/provider';
import type { ProviderOperation } from '../src/provider-operations';

test('metadata is a snapshot and inspection never starts a factory', async () => {
  let calls = 0;
  const payload = { team: 'platform' };
  const input = { 'app:owner': payload };
  const provider = DiBag.withMetadata(() => { calls++; return { read: () => 42 }; }, { static: input });
  const bag = DiBag.createBuilder().register({ service: provider }).build();
  input['app:owner'] = { team: 'changed' };
  const before = bag.inspect('service');
  expect(calls).toBe(0);
  expect(before.registrationMetadata['app:owner']).toBe(payload);
  expect(before.acquisitions).toEqual([]);
  expect(Object.isFrozen(before.registrationMetadata)).toBe(true);
  expect(Object.isFrozen(payload)).toBe(false);
  expect(Object.isFrozen(provider)).toBe(true);
  expect(bag.resolve('service').read()).toBe(42);
  const after = bag.inspect('service');
  expect(after.bindingId).toBe(before.bindingId);
  expect(after.label).toBe('service');
  expect(after.acquisitions).toHaveLength(1);
  expect(after.acquisitions[0]?.state).toBe('ready');
  expect(after.acquisitions[0]?.acquisitionMetadata).toEqual([]);
  for (const value of [after, after.acquisitions, after.acquisitions[0], after.acquisitions[0]?.acquisitionMetadata]) {
    expect(Object.isFrozen(value)).toBe(true);
  }
  expect(Reflect.ownKeys(after)).toEqual(['bindingId', 'label', 'registrationMetadata', 'acquisitions']);
  expect(Reflect.ownKeys(after.acquisitions[0]!)).toEqual(['acquisitionId', 'state', 'acquisitionMetadata']);
  expect(before.acquisitions).toEqual([]);
  await bag.close();
  expect(bag.inspect('service').acquisitions).toEqual([]);
  expect(bag.inspect('service').registrationMetadata['app:owner']).toBe(payload);
  expect(after.acquisitions[0]?.state).toBe('ready');
});

test('metadata preflight sees hidden collisions before reading any getters', () => {
  const events: string[] = [];
  const initial = { owner: 'platform' };
  Object.defineProperty(initial, 'hidden', { value: 42 });
  const provider = DiBag.withMetadata(() => 1, { static: initial });
  const more = {
    get fresh() { events.push('fresh'); return true; },
  };
  Object.defineProperty(more, 'hidden', { get() { events.push('hidden'); return 7; } });
  expect(() => DiBag.withMetadata(provider, { static: more })).toThrow('duplicate metadata');
  expect(events).toEqual([]);
  const bag = DiBag.createBuilder().register({ provider }).build();
  expect(Reflect.get(bag.inspect('provider').registrationMetadata, 'hidden')).toBe(42);
});

test('metadata additions preserve symbol keys and snapshot accessors once', () => {
  const key = Symbol('app:tag');
  const payload = { tag: 'active' };
  let reads = 0;
  const metadata = { get [key]() { reads++; return payload; } };
  const base = DiBag.withMetadata(() => 42, { static: metadata });
  const extended = DiBag.withMetadata(base, { static: { owner: 'platform' } });
  const bag = DiBag.createBuilder().register({ base, extended }).build();
  expect(reads).toBe(1);
  expect(bag.inspect('extended').registrationMetadata[key]).toBe(payload);
  expect(bag.inspect('base').registrationMetadata).not.toHaveProperty('owner');
  expect(Object.getOwnPropertyDescriptor(bag.inspect('extended').registrationMetadata, key)?.get).toBeUndefined();
});

test('runtime rejects copied and forged provider registrations', () => {
  const provider = DiBag.withMetadata(() => 42, { static: { owner: 'platform' } });
  const add = DiBag.createBuilder().register.bind(DiBag.createBuilder()) as (value: unknown) => unknown;
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
  const bag = DiBag.createBuilder().register({ service: DiBag.withMetadata(DiBag.withDisposal(
    () => calls++ === 0 ? first : second,
    value => { disposed = value; expect(bag.inspect('service').acquisitions[0]?.state).toBe('disposing'); },
  ), { static: { owner: 'platform' } }) }).build();
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
  const unit = DiBag.createModuleBuilder().register({
    privateValue: () => 42,
    service: DiBag.withMetadata(({ privateValue }: { privateValue: number }) => privateValue, { static: { owner: 'module' } }),
  }).buildModule(['service']).renameExport('service', 'client');
  const bag = DiBag.createBuilder().installModule(unit).build();
  const child = bag.fork(['client'], { client: DiBag.withMetadata(() => 7, { static: { child: true } }) });
  expect(bag.inspect('client').registrationMetadata.owner).toBe('module');
  expect(bag.inspect('client').acquisitions).toEqual([]);
  expect(child.inspect('client').registrationMetadata.child).toBe(true);
  expect(child.inspect('client').bindingId).not.toBe(bag.inspect('client').bindingId);
  expect(bag.resolve('client')).toBe(42);
  expect(child.resolve('client')).toBe(7);
  await Promise.all([bag.close(), child.close()]);
});

test('plain registrations expose empty metadata and frames, including creating snapshots', async () => {
  let creating: unknown;
  const bag = DiBag.createBuilder().register({ service: () => { creating = bag.inspect('service').acquisitions[0]?.state; return 42; } }).build();
  expect(bag.inspect('service').registrationMetadata).toEqual({});
  expect(bag.resolve('service')).toBe(42);
  expect(creating).toBe('creating');
  expect(bag.inspect('service').acquisitions[0]?.acquisitionMetadata).toEqual([]);
  await bag.close();
});

test('metadata preserves synchronous ownership and borrowed cleanup methods', async () => {
  const raw = { id: 42 };
  const disposed: unknown[] = [];
  const borrowed = { close() { throw new Error('borrowed must not close'); } };
  const bag = DiBag.createBuilder().register({
    owned: DiBag.withMetadata(DiBag.withDisposal(() => raw, value => { disposed.push(value); }), { static: { owner: 'platform' } }),
    borrowed: DiBag.withMetadata(() => borrowed, { static: { owner: 'external' } }),
  }).build();
  expect(bag.resolve('owned')).toBe(raw);
  expect(bag.resolve('borrowed')).toBe(borrowed);
  await bag.close();
  expect(disposed).toEqual([raw]);
  expect(disposed[0]).toBe(raw);
});
test('provider execution captures projected values and acquisition frames', async () => {
  // Exercise the frame engine independently of public decorators.
  const operation: ProviderOperation = { kind: 'frame-sync', acquisitionMode: 'raw', project: () => ({ value: 42, frame: Object.freeze({ source: 'engine' }) }) };
  const registration = transform<() => object, () => number, readonly [unknown]>(() => ({}), operation);
  const bag = DiBag.createBuilder().register({ value: registration }).build();
  expect(bag.resolve('value')).toBe(42);
  expect(bag.inspect('value').acquisitions[0]!.acquisitionMetadata).toEqual([
    { present: true, value: { source: 'engine' } },
  ]);
  await bag.close();
});
