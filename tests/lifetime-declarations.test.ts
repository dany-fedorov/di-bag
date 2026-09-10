import { expect, test } from 'bun:test';
import { DiBag } from '../src/node';
import { withLifetime } from '../src/lifetime';
import { normalize } from '../src/provider-operations';
import { withTokenBinding } from '../src/provider';

test('lifetime replacement preserves the source and owned stages', () => {
  let calls = 0;
  const source = DiBag.withDisposal(() => { calls++; return { n: 1 }; }, () => {});
  const root = withLifetime(source, 'root', { allowScopedDependencies: true });
  const next = withLifetime(DiBag.withMetadata(root, { static: { owner: 'app' } }), 'transient');
  expect(calls).toBe(0);
  expect(normalize(root).lifetime).toEqual({ kind: 'root', allowScopedDependencies: true });
  expect(normalize(next).lifetime).toEqual({ kind: 'transient', allowScopedDependencies: false });
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
  expect(normalize(withLifetime(source, 'root')).lifetime).toEqual({ kind: 'root', allowScopedDependencies: false });
  expect(normalize(source).lifetime.allowScopedDependencies).toBe(true);
  const mutable = { allowScopedDependencies: true };
  const copied = withLifetime(() => 1, 'root', mutable);
  mutable.allowScopedDependencies = false;
  expect(normalize(copied).lifetime.allowScopedDependencies).toBe(true);
  expect(normalize(() => 1).lifetime).toEqual({ kind: 'scoped', allowScopedDependencies: false });
});

test('all provider transformations retain the immutable policy', () => {
  const source = withLifetime(() => 1, 'root');
  const key = Symbol('value');
  const token = DiBag.token(key).of<ReturnType<ReturnType<typeof normalize>['create']>>();
  const variants = [DiBag.withMetadata(source, { static: { x: 1 } }), DiBag.withDisposal(source, () => {}), DiBag.transformService(source, { mode: 'direct', transform: x => x }), DiBag.transformService(source, { mode: 'awaited', transform: x => x }),
    DiBag.withMetadata(source, { dynamic: { mode: 'direct', describe: value => ({ value }) } }), DiBag.withMetadata(source, { dynamic: { mode: 'awaited', describe: value => ({ value }) } }), withTokenBinding(token, source)];
  for (const variant of variants) expect(normalize(variant).lifetime).toBe(normalize(source).lifetime);
});
