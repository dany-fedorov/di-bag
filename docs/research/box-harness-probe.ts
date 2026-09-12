// Executable research probe. See 2026-09-12-box-harness-evidence.md for setup and commands.
import assert from 'node:assert/strict';
import { SasBox } from '../../../sas-box/src/index';
import { ValBox } from '../../../val-box/src/index';

type Provider<T> = { sync?: () => T; async: () => Promise<Awaited<T>> };
const plainSync = <T>(fn: () => T): Provider<T> & { sync: () => T } => ({
  sync: fn,
  async: async () => fn(),
});
const plainAsync = <T>(fn: () => PromiseLike<T>): Provider<Awaited<T>> => ({
  async: async () => fn(),
});
const requireSync = <T>(p: Provider<T>): (() => T) => {
  if (!p.sync) throw new Error('sync route missing');
  return p.sync;
};

for (const [name, makeSync, makeAsync] of [
  ['sas', SasBox.fromSync, SasBox.fromAsync],
  ['plain', plainSync, plainAsync],
] as const) {
  let calls = 0;
  const p = makeSync(() => ++calls);
  assert.equal(p.sync(), 1);
  assert.equal(await p.async(), 2);
  let failures = 0;
  const expected = new Error('transient');
  const fails = makeSync(() => { failures++; throw expected; });
  assert.throws(() => fails.sync(), e => e === expected);
  await assert.rejects(fails.async(), e => e === expected);
  await assert.rejects(fails.async(), e => e === expected);
  assert.equal(failures, 3);
  let acquisitions = 0;
  let release!: () => void;
  const gate = new Promise<void>(r => { release = r; });
  const remote = makeAsync(async () => { acquisitions++; await gate; return acquisitions; });
  const a = remote.async(), b = remote.async();
  assert.equal(acquisitions, 2);
  release();
  await Promise.all([a, b]);
  assert.equal(remote.sync, undefined);
  console.log(`${name}: repeated calls=2; failure executions=3; concurrent acquisitions=2; sync after await=undefined`);
}

let evaluations = 0;
const guard = SasBox.fromSync(() => { evaluations++; return true; });
assert.equal(guard.hasSync(), true);
assert.equal(evaluations, 0);
assert.equal(guard.assertHasSync().sync(), true);
assert.equal(requireSync(plainSync(() => true))(), true);
const events: string[] = [];
const immediate = SasBox.fromSync(() => { events.push('provider'); return 1; });
const result = immediate.async().then(() => events.push('then'));
events.push('caller');
assert.deepEqual(events, ['provider', 'caller']);
await result;
assert.deepEqual(events, ['provider', 'caller', 'then']);
const rawPromise = Promise.resolve(1);
assert.equal(SasBox.fromSync(() => rawPromise).sync(), rawPromise);
const divergent = new SasBox.Sync(() => 1, async () => 2);
assert.equal(divergent.sync(), 1);
assert.equal(await divergent.async(), 2);
assert.equal(await divergent.resolveSyncFirst(), 1);
let recursions = 0;
let recursive!: SasBox.Sync<number>;
const stop = new Error('host sentinel');
recursive = SasBox.fromSync(() => {
  recursions++;
  if (recursions === 5) throw stop;
  return recursive.sync();
});
assert.throws(() => recursive.sync(), e => e === stop);
assert.equal(recursions, 5);
assert.equal('map' in guard, false);
assert.equal('metadata' in guard, false);
console.log('sas: inspection executions=0; ordering=provider,caller,then; dual routes may differ; recursive calls reached host sentinel=5; no map/metadata');

type Presence<T> = { readonly present: false } | { readonly present: true; readonly value: T };
const absent = <T>(): Presence<T> => Object.freeze({ present: false });
const present = <T>(value: T): Presence<T> => Object.freeze({ present: true, value });
const plainSnapshot = <V, M>(value: Presence<V>, metadata: Presence<M>, alias: string | null = null) =>
  Object.freeze({ value, metadata, alias });
for (const value of [undefined, null, false, 0, '', NaN]) {
  const box = new ValBox.Unknown<unknown, unknown>().setValue(value).setMetadata(value);
  assert.deepEqual(box.snapshot(), plainSnapshot(present(value), present(value)));
  assert.equal(box.hasValue(), true);
  assert.equal(box.hasMetadata(), true);
}
const empty = new ValBox.Unknown<unknown, unknown>();
assert.deepEqual(empty.snapshot(), plainSnapshot(absent(), absent()));
const payload = { count: 1 };
const metadata = { source: 'untrusted', fresh: true };
const box = new ValBox.Unknown<typeof payload, typeof metadata>().setValue(payload).setMetadata(metadata);
const shot = box.snapshot();
const converted = box.convert({});
box.setValue({ count: 8 }).delMetadata();
payload.count = 99;
metadata.fresh = false;
assert.equal(shot.value.present && shot.value.value.count, 99);
assert.equal(shot.metadata.present && shot.metadata.value.fresh, false);
assert.equal(converted.getValue()?.count, 99);
assert.equal(Object.isFrozen(box), false);
assert.equal(Object.isFrozen(converted), false);
assert.equal(Object.isFrozen(shot), true);
assert.equal(Object.isFrozen(payload), false);
const undefinedShot = new ValBox.Unknown<undefined, undefined>().setValue(undefined).setMetadata(undefined).snapshot();
const json = JSON.stringify(undefinedShot);
assert.equal(json, '{"value":{"present":true},"metadata":{"present":true},"alias":null}');
assert.equal(JSON.parse(json).value.present, true);
assert.equal(Object.hasOwn(JSON.parse(json).value, 'value'), false);
const nanShot = new ValBox.Unknown<number, never>().setValue(NaN).snapshot();
assert.equal(JSON.parse(JSON.stringify(nanShot)).value.value, null);
assert.equal(ValBox.isValBox(JSON.parse(json)), false);
assert.equal('map' in box, false);
const replaced = new ValBox.WithValue.WithMetadata(1, 'original');
replaced.setValue(2).setMetadata('replacement');
assert.equal(replaced.getValue(), 2);
assert.throws(() => replaced.delValue(), ValBox.MethodNotAllowedError);
console.log('val: 6 falsy/undefined cases equal plain unions on both axes; box/convert mutable; snapshot shallow-frozen; nested mutation visible; no map');
console.log(`val: present undefined JSON=${json}; NaN becomes null; decoded JSON is not a ValBox`);
