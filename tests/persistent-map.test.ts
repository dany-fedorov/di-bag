import { expect, test } from 'bun:test';
import { PersistentMap } from '../src/persistent-map';

test('collision replacement and deletion preserve other keys and earlier versions', () => {
  const initial = new PersistentMap<number>().set('costarring', 1).set('liquid', 2).set('unrelated', 3);
  const replaced = initial.set('costarring', 4);
  const removed = replaced.delete('liquid');
  expect([...initial].map(([key, value]) => [key, value]).sort()).toEqual([['costarring', 1], ['liquid', 2], ['unrelated', 3]]);
  expect(removed.get('costarring')).toBe(4);
  expect(removed.has('liquid')).toBe(false);
  expect(removed.get('unrelated')).toBe(3);
  expect(replaced.get('liquid')).toBe(2);
  expect(removed.delete('missing').get('costarring')).toBe(4);
  expect(removed.delete('costarring').delete('unrelated').get('unrelated')).toBeUndefined();
});

test('mixed insert/delete operations agree with an independent native map', () => {
  const keys: (string | symbol)[] = Array.from({ length: 1024 }, (_, i) => `item${i}`);
  keys.push(...Array.from({ length: 1024 }, () => Symbol('same')), Symbol.for('same'), Symbol.iterator, '__proto__');
  const expected = new Map<string | symbol, number>();
  let map = new PersistentMap<number>(), seed = 17;
  for (let i = 0; i < 20000; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const key = keys[seed % keys.length]!;
    if (seed % 7 === 0) { map = map.delete(key); expected.delete(key); }
    else { map = map.set(key, i); expected.set(key, i); }
  }
  for (const key of keys) { expect(map.get(key)).toBe(expected.get(key)); expect(map.has(key)).toBe(expected.has(key)); }
  expect(new Map(map)).toEqual(expected);
});
