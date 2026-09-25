import { expect, test } from 'bun:test';
import { DiBag } from '../src';
import { transform } from '../src/provider';
import type { ProviderOperation } from '../src/provider-operations';

test('metadata is a snapshot and inspection never starts a factory', async () => {
  let calls = 0;
  const payload = { team: 'platform' };
  const input = { 'app:owner': payload };
  const provider = DiBag.providerWithRegistrationMetadata({ provider: () => { calls++; return { read: () => 42 }; }, registrationMetadata: input });
  const bag = DiBag.createBuilder().withServices({ service: provider }).buildContainer();
  input['app:owner'] = { team: 'changed' };
  const before = bag.serviceSnapshot('service');
  expect(calls).toBe(0);
  expect(before.registrationMetadata['app:owner']).toBe(payload);
  expect(before.acquisitions).toEqual([]);
  expect(Object.isFrozen(before.registrationMetadata)).toBe(true);
  expect(Object.isFrozen(payload)).toBe(false);
  expect(Object.isFrozen(provider)).toBe(true);
  expect(bag.resolve('service').read()).toBe(42);
  const after = bag.serviceSnapshot('service');
  expect(after.bindingId).toBe(before.bindingId);
  expect(after.bindingLabel).toBe('service');
  expect(after.acquisitions).toHaveLength(1);
  expect(after.acquisitions[0]?.state).toBe('ready');
  expect(after.acquisitions[0]?.acquisitionMetadata).toEqual([]);
  for (const value of [after, after.acquisitions, after.acquisitions[0], after.acquisitions[0]?.acquisitionMetadata]) {
    expect(Object.isFrozen(value)).toBe(true);
  }
  expect(Reflect.ownKeys(after)).toEqual(['bindingId', 'bindingLabel', 'registrationMetadata', 'acquisitions']);
  expect(Reflect.ownKeys(after.acquisitions[0]!)).toEqual(['acquisitionId', 'state', 'acquisitionMetadata']);
  expect(before.acquisitions).toEqual([]);
  await bag.close();
  expect(bag.serviceSnapshot('service').acquisitions).toEqual([]);
  expect(bag.serviceSnapshot('service').registrationMetadata['app:owner']).toBe(payload);
  expect(after.acquisitions[0]?.state).toBe('ready');
});

test('metadata preflight sees hidden collisions before reading any getters', () => {
  const events: string[] = [];
  const initial = { owner: 'platform' };
  Object.defineProperty(initial, 'hidden', { value: 42 });
  const provider = DiBag.providerWithRegistrationMetadata({ provider: () => 1, registrationMetadata: initial });
  const more = {
    get fresh() { events.push('fresh'); return true; },
  };
  Object.defineProperty(more, 'hidden', { get() { events.push('hidden'); return 7; } });
  expect(() => DiBag.providerWithRegistrationMetadata({ provider: provider, registrationMetadata: more })).toThrow('duplicate registration metadata');
  expect(events).toEqual([]);
  const bag = DiBag.createBuilder().withServices({ provider }).buildContainer();
  expect(Reflect.get(bag.serviceSnapshot('provider').registrationMetadata, 'hidden')).toBe(42);
});

test('metadata additions preserve symbol keys and snapshot accessors once', () => {
  const key = Symbol('app:tag');
  const payload = { tag: 'active' };
  let reads = 0;
  const metadata = { get [key]() { reads++; return payload; } };
  const base = DiBag.providerWithRegistrationMetadata({ provider: () => 42, registrationMetadata: metadata });
  const extended = DiBag.providerWithRegistrationMetadata({ provider: base, registrationMetadata: { owner: 'platform' } });
  const bag = DiBag.createBuilder().withServices({ base, extended }).buildContainer();
  expect(reads).toBe(1);
  expect(bag.serviceSnapshot('extended').registrationMetadata[key]).toBe(payload);
  expect(bag.serviceSnapshot('base').registrationMetadata).not.toHaveProperty('owner');
  expect(Object.getOwnPropertyDescriptor(bag.serviceSnapshot('extended').registrationMetadata, key)?.get).toBeUndefined();
});

test('runtime rejects copied and forged provider registrations', () => {
  const provider = DiBag.providerWithRegistrationMetadata({ provider: () => 42, registrationMetadata: { owner: 'platform' } });
  const add = DiBag.createBuilder().withServices.bind(DiBag.createBuilder()) as (value: unknown) => unknown;
  expect(() => add({ service: { ...provider } })).toThrow('invalid provider or factory');
  expect(() => add({ service: Object.create(Object.getPrototypeOf(provider)) })).toThrow('invalid provider or factory');
});

test('inspection follows pending retries without retaining failed attempts or changing disposal', async () => {
  let reject!: (reason: unknown) => void;
  let accept!: (value: { id: number }) => void;
  const raw = { id: 42 };
  const first = new Promise<{ id: number }>((_, no) => { reject = no; });
  const second = new Promise<{ id: number }>(yes => { accept = yes; });
  let calls = 0;
  let disposed: unknown;
  const bag = DiBag.createBuilder().withServices({ service: DiBag.providerWithRegistrationMetadata({ provider: DiBag.providerWithDisposal({ provider: () => calls++ === 0 ? first : second, disposeService: value => { disposed = value; expect(bag.serviceSnapshot('service').acquisitions[0]?.state).toBe('disposing'); } }), registrationMetadata: { owner: 'platform' } }) }).buildContainer();
  expect(bag.resolve('service')).toBe(first);
  const pending = bag.serviceSnapshot('service');
  expect(pending.acquisitions[0]?.state).toBe('pending');
  reject(new Error('retry'));
  await first.catch(() => {});
  expect(bag.serviceSnapshot('service').acquisitions).toEqual([]);
  expect(bag.resolve('service')).toBe(second);
  expect(bag.serviceSnapshot('service').acquisitions[0]?.acquisitionId).not.toBe(pending.acquisitions[0]?.acquisitionId);
  accept(raw);
  await second;
  await bag.close();
  expect(disposed).toBe(raw);
  expect(bag.serviceSnapshot('service').acquisitions).toEqual([]);
  expect(pending.acquisitions[0]?.state).toBe('pending');
});

test('module rename and fork keep metadata with the actual binding', async () => {
  const unit = DiBag.createBuilder().withServices({
    privateValue: () => 42,
    service: DiBag.providerWithRegistrationMetadata({ provider: ({ privateValue }: { privateValue: number }) => privateValue, registrationMetadata: { owner: 'module' } }),
  }).buildModule({ exportedServiceKeys: ['service'] }).withRenamedExport({ currentExportKey: 'service', newExportKey: 'client' });
  const bag = DiBag.createBuilder().withInstalledModules([unit]).buildContainer();
  const child = bag.createIndependentContainer(['client'], { client: DiBag.providerWithRegistrationMetadata({ provider: () => 7, registrationMetadata: { child: true } }) });
  expect(bag.serviceSnapshot('client').registrationMetadata.owner).toBe('module');
  expect(bag.serviceSnapshot('client').acquisitions).toEqual([]);
  expect(child.serviceSnapshot('client').registrationMetadata.child).toBe(true);
  expect(child.serviceSnapshot('client').bindingId).not.toBe(bag.serviceSnapshot('client').bindingId);
  expect(bag.resolve('client')).toBe(42);
  expect(child.resolve('client')).toBe(7);
  await Promise.all([bag.close(), child.close()]);
});

test('plain registrations expose empty metadata and frames, including creating snapshots', async () => {
  let creating: unknown;
  const bag = DiBag.createBuilder().withServices({ service: () => { creating = bag.serviceSnapshot('service').acquisitions[0]?.state; return 42; } }).buildContainer();
  expect(bag.serviceSnapshot('service').registrationMetadata).toEqual({});
  expect(bag.resolve('service')).toBe(42);
  expect(creating).toBe('creating');
  expect(bag.serviceSnapshot('service').acquisitions[0]?.acquisitionMetadata).toEqual([]);
  await bag.close();
});

test('metadata preserves synchronous ownership and borrowed cleanup methods', async () => {
  const raw = { id: 42 };
  const disposed: unknown[] = [];
  const borrowed = { close() { throw new Error('borrowed must not close'); } };
  const bag = DiBag.createBuilder().withServices({
    owned: DiBag.providerWithRegistrationMetadata({ provider: DiBag.providerWithDisposal({ provider: () => raw, disposeService: value => { disposed.push(value); } }), registrationMetadata: { owner: 'platform' } }),
    borrowed: DiBag.providerWithRegistrationMetadata({ provider: () => borrowed, registrationMetadata: { owner: 'external' } }),
  }).buildContainer();
  expect(bag.resolve('owned')).toBe(raw);
  expect(bag.resolve('borrowed')).toBe(borrowed);
  await bag.close();
  expect(disposed).toEqual([raw]);
  expect(disposed[0]).toBe(raw);
});
test('provider execution captures projected values and acquisition frames', async () => {
  // Exercise the frame engine independently of public decorators.
  const operation: ProviderOperation = { kind: 'frame-sync', factoryReturnKind: 'uninspected', project: () => ({ value: 42, frame: Object.freeze({ source: 'engine' }) }) };
  const registration = transform<() => object, () => number, readonly [unknown]>(() => ({}), operation);
  const bag = DiBag.createBuilder().withServices({ value: registration }).buildContainer();
  expect(bag.resolve('value')).toBe(42);
  expect(bag.serviceSnapshot('value').acquisitions[0]!.acquisitionMetadata).toEqual([
    { isPresent: true, value: { source: 'engine' } },
  ]);
  await bag.close();
});
