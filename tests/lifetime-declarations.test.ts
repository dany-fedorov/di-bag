import { expect, test } from 'bun:test';
import { DiBag } from '../src/node';
import { withLifetime } from '../src/lifetime';
import { normalize } from '../src/provider-operations';
import { withTokenBinding } from '../src/provider';

test('lifetime replacement preserves the source and owned stages', () => {
  let calls = 0;
  const source = DiBag.withDisposal(() => { calls++; return { n: 1 }; }, () => {});
  const root = withLifetime(source, 'root', { captureScoped: true });
  const next = withLifetime(DiBag.withMetadata(root, { owner: 'app' }), 'transient');
  expect(calls).toBe(0);
  expect(normalize(root).lifetime).toEqual({ kind: 'root', captureScoped: true });
  expect(normalize(next).lifetime).toEqual({ kind: 'transient', captureScoped: false });
  expect(normalize(next).create).toBe(normalize(source).create);
  expect(normalize(next).dispose).toBe(normalize(source).dispose);
  expect(Object.isFrozen(normalize(next).lifetime)).toBe(true);
});

test('invalid lifetime declarations fail before evaluating factories or option getters', () => {
  const unchecked = withLifetime as (...args: unknown[]) => unknown;
  let calls = 0;
  const source = () => { calls++; return 1; };
  for (const policy of ['singleton', undefined, null, {}, 1]) expect(() => unchecked(source, policy)).toThrow('lifetime');
  for (const options of [null, [], true, 1, 'root', { other: true }, { captureScoped: 1 }, { captureScoped: undefined }, Object.create({ captureScoped: true })]) {
    expect(() => unchecked(source, 'root', options)).toThrow('lifetime');
  }
  for (const policy of ['scoped', 'transient']) for (const captureScoped of [true, false, undefined]) {
    expect(() => unchecked(source, policy, { captureScoped })).toThrow('lifetime');
  }
  expect(() => unchecked(source, 'root', { other: 1, get captureScoped() { calls++; return true; } })).toThrow('lifetime');
  expect(calls).toBe(0);
});

test('options are read once and snapshotted, and replacement clears capture', () => {
  let reads = 0;
  const options = { get captureScoped() { reads++; return true; } };
  const source = withLifetime(() => 1, 'root', options);
  expect(reads).toBe(1);
  expect(normalize(withLifetime(source, 'root')).lifetime).toEqual({ kind: 'root', captureScoped: false });
  expect(normalize(source).lifetime.captureScoped).toBe(true);
  const mutable = { captureScoped: true };
  const copied = withLifetime(() => 1, 'root', mutable);
  mutable.captureScoped = false;
  expect(normalize(copied).lifetime.captureScoped).toBe(true);
  expect(normalize(() => 1).lifetime).toEqual({ kind: 'scoped', captureScoped: false });
});

test('all provider transformations retain the immutable policy', () => {
  const source = withLifetime(() => 1, 'root');
  const key = Symbol('value');
  const token = DiBag.token(key).of<ReturnType<ReturnType<typeof normalize>['create']>>();
  const variants = [DiBag.withMetadata(source, { x: 1 }), DiBag.withDisposal(source, () => {}), DiBag.mapSync(source, x => x), DiBag.mapAsync(source, x => x),
    DiBag.withAcquisitionMetadata(source, value => ({ value })), DiBag.withAcquisitionMetadataAsync(source, value => ({ value })), withTokenBinding(token, source)];
  for (const variant of variants) expect(normalize(variant).lifetime).toBe(normalize(source).lifetime);
});
