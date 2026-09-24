import { expect, test } from 'bun:test';
import { DiBag } from '../src';
import { normalize } from '../src/provider-operations';
import { withTokenBinding } from '../src/provider';

test('lifetime replacement preserves the source and owned stages', () => {
  let calls = 0;
  const source = DiBag.providerWithDisposal({ provider: () => { calls++; return { n: 1 }; }, disposeService: () => {} });
  const root = DiBag.providerWithLifetime({ provider: source, lifetime: 'singleton:one-per-container-tree', allowsScopedDependencies: true });
  const next = DiBag.providerWithLifetime({ provider: DiBag.providerWithRegistrationMetadata({ provider: root, registrationMetadata: { owner: 'app' } }), lifetime: 'transient:one-per-resolve' });
  expect(calls).toBe(0);
  expect(normalize(root).lifetime).toEqual({ kind: 'singleton', allowsScopedDependencies: true });
  expect(normalize(next).lifetime).toEqual({ kind: 'transient', allowsScopedDependencies: false });
  expect(normalize(next).create).toBe(normalize(source).create);
  expect(normalize(next).dispose).toBe(normalize(source).dispose);
  expect(Object.isFrozen(normalize(next).lifetime)).toBe(true);
});

test('invalid lifetime declarations fail before evaluating factories or option getters', () => {
  const unchecked = DiBag.providerWithLifetime as (options: unknown) => unknown;
  let calls = 0;
  const source = () => { calls++; return 1; };
  for (const policy of ['singleton', undefined, null, {}, 1]) expect(() => unchecked({ provider: source, lifetime: policy })).toThrow(/lifetime/i);
  const base = { provider: source, lifetime: 'singleton:one-per-container-tree' };
  const inherited = Object.assign(Object.create({ allowsScopedDependencies: true }), base);
  for (const options of [null, [], true, 1, 'root', { ...base, other: true }, { ...base, allowsScopedDependencies: 1 }, { ...base, allowsScopedDependencies: undefined }, inherited]) {
    expect(() => unchecked(options)).toThrow();
  }
  for (const policy of ['scoped:one-per-container', 'transient:one-per-resolve']) for (const allowsScopedDependencies of [true, false, undefined]) {
    expect(() => unchecked({ provider: source, lifetime: policy, allowsScopedDependencies })).toThrow(/lifetime/i);
  }
  expect(() => unchecked({ provider: source, lifetime: 'singleton:one-per-container-tree', other: 1, get allowsScopedDependencies() { calls++; return true; } })).toThrow();
  expect(calls).toBe(0);
});

test('options are read once and snapshotted, and replacement clears capture', () => {
  let reads = 0;
  const options = { provider: () => 1, lifetime: 'singleton:one-per-container-tree' as const, get allowsScopedDependencies() { reads++; return true; } };
  const source = DiBag.providerWithLifetime(options);
  expect(reads).toBe(1);
  expect(normalize(DiBag.providerWithLifetime({ provider: source, lifetime: 'singleton:one-per-container-tree' })).lifetime).toEqual({ kind: 'singleton', allowsScopedDependencies: false });
  expect(normalize(source).lifetime.allowsScopedDependencies).toBe(true);
  const mutable = { allowsScopedDependencies: true };
  const copied = DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'singleton:one-per-container-tree', ...mutable });
  mutable.allowsScopedDependencies = false;
  expect(normalize(copied).lifetime.allowsScopedDependencies).toBe(true);
  expect(normalize(() => 1).lifetime).toEqual({ kind: 'scoped', allowsScopedDependencies: false });
});

test('all provider transformations retain the immutable policy', () => {
  const source = DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'singleton:one-per-container-tree' });
  const key = Symbol('value');
  const token = DiBag.createToken(key).forService<ReturnType<ReturnType<typeof normalize>['create']>>();
  const variants = [DiBag.providerWithRegistrationMetadata({ provider: source, registrationMetadata: { x: 1 } }), DiBag.providerWithDisposal({ provider: source, disposeService: () => {} }), DiBag.providerWithTransformedService({ provider: source, transformService: x => x, callbackReceives: 'exposed-service' }), DiBag.providerWithTransformedService({ provider: source, transformService: x => x, callbackReceives: 'fulfilled-value' }),
    DiBag.providerWithAcquisitionMetadata({ provider: source, describeAcquisition: value => ({ value }), callbackReceives: 'exposed-service' }), DiBag.providerWithAcquisitionMetadata({ provider: source, describeAcquisition: value => ({ value }), callbackReceives: 'fulfilled-value' }), withTokenBinding(token, source)];
  for (const variant of variants) expect(normalize(variant).lifetime).toBe(normalize(source).lifetime);
});
