import { expect, test } from 'bun:test';
import { DiBag } from '../src';
import { withLifetime } from '../src/lifetime';
import { normalize } from '../src/provider-operations';
import { withTokenBinding } from '../src/provider';

test('lifetime replacement preserves the source and owned stages', () => {
  let calls = 0;
  const source = DiBag.providerWithDisposal({ provider: () => { calls++; return { n: 1 }; }, disposeService: () => {} });
  const root = withLifetime(source, 'root', { allowScopedDependencies: true });
  const next = withLifetime(DiBag.providerWithRegistrationMetadata({ provider: root, registrationMetadata: { owner: 'app' } }), 'transient');
  expect(calls).toBe(0);
  expect(normalize(root).lifetime).toEqual({ kind: 'singleton', allowsScopedDependencies: true });
  expect(normalize(next).lifetime).toEqual({ kind: 'transient', allowsScopedDependencies: false });
  expect(normalize(next).create).toBe(normalize(source).create);
  expect(normalize(next).dispose).toBe(normalize(source).dispose);
  expect(Object.isFrozen(normalize(next).lifetime)).toBe(true);
});

test('invalid lifetime declarations fail before evaluating factories or option getters', () => {
  const unchecked = withLifetime as (...args: unknown[]) => unknown;
  let calls = 0;
  const source = () => { calls++; return 1; };
  for (const policy of ['singleton', undefined, null, {}, 1]) expect(() => unchecked(source, policy)).toThrow(/lifetime/i);
  for (const options of [null, [], true, 1, 'root', { other: true }, { allowScopedDependencies: 1 }, { allowScopedDependencies: undefined }, Object.create({ allowScopedDependencies: true })]) {
    expect(() => unchecked(source, 'root', options)).toThrow(/lifetime/i);
  }
  for (const policy of ['scoped', 'transient']) for (const allowScopedDependencies of [true, false, undefined]) {
    expect(() => unchecked(source, policy, { allowScopedDependencies })).toThrow(/lifetime/i);
  }
  expect(() => unchecked(source, 'root', { other: 1, get allowScopedDependencies() { calls++; return true; } })).toThrow(/lifetime/i);
  expect(calls).toBe(0);
});

test('options are read once and snapshotted, and replacement clears capture', () => {
  let reads = 0;
  const options = { get allowScopedDependencies() { reads++; return true; } };
  const source = withLifetime(() => 1, 'root', options);
  expect(reads).toBe(1);
  expect(normalize(withLifetime(source, 'root')).lifetime).toEqual({ kind: 'singleton', allowsScopedDependencies: false });
  expect(normalize(source).lifetime.allowsScopedDependencies).toBe(true);
  const mutable = { allowScopedDependencies: true };
  const copied = withLifetime(() => 1, 'root', mutable);
  mutable.allowScopedDependencies = false;
  expect(normalize(copied).lifetime.allowsScopedDependencies).toBe(true);
  expect(normalize(() => 1).lifetime).toEqual({ kind: 'scoped', allowsScopedDependencies: false });
});

test('all provider transformations retain the immutable policy', () => {
  const source = withLifetime(() => 1, 'root');
  const key = Symbol('value');
  const token = DiBag.createToken(key).forService<ReturnType<ReturnType<typeof normalize>['create']>>();
  const variants = [DiBag.providerWithRegistrationMetadata({ provider: source, registrationMetadata: { x: 1 } }), DiBag.providerWithDisposal({ provider: source, disposeService: () => {} }), DiBag.providerWithTransformedService({ provider: source, transformService: x => x, callbackReceives: 'exposed-service' }), DiBag.providerWithTransformedService({ provider: source, transformService: x => x, callbackReceives: 'fulfilled-value' }),
    DiBag.providerWithAcquisitionMetadata({ provider: source, describeAcquisition: value => ({ value }), callbackReceives: 'exposed-service' }), DiBag.providerWithAcquisitionMetadata({ provider: source, describeAcquisition: value => ({ value }), callbackReceives: 'fulfilled-value' }), withTokenBinding(token, source)];
  for (const variant of variants) expect(normalize(variant).lifetime).toBe(normalize(source).lifetime);
});
