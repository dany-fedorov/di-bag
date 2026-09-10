import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const [entry, mode, countText] = process.argv.slice(2);
const { DiBag } = createRequire(import.meta.url)(entry);
const count = Number(countText);
if (mode === 'chain') {
  const tokens = Array.from({ length: count }, (_, index) => DiBag.token(Symbol(`p${index}`)).of());
  const calls = Array(count).fill(0);
  let builder = DiBag.begin();
  for (let index = 0; index < count; index++) builder = builder.bind(tokens[index], DiBag.fromTokens(index ? [tokens[index - 1]] : [], value => { calls[index]++; return index ? value + 1 : 1; }, { acquisition: 'raw' }));
  const bag = builder.end();
  try {
    assert.equal(bag.resolve(tokens.at(-1)), count);
    assert.deepEqual(calls, Array(count).fill(1));
    console.log(JSON.stringify({ mode, count, status: 'pass', calls: calls.reduce((a,b) => a+b, 0) }));
  } catch (error) {
    console.log(JSON.stringify({ mode, count, status: 'failed', error: String(error), calls: calls.reduce((a,b) => a+b, 0) }));
    throw error;
  } finally { await bag.close(); }
} else {
  const token = DiBag.token(Symbol('transient')).of();
  const absent = DiBag.token(Symbol('absent')).of();
  let calls = 0;
  const events = [], disposed = [];
  const facade = DiBag.observe({ onEvent(event) { if (event.kind === 'acquisition-started') events.push(event.label); }, onError(error) { throw error; } });
  const provider = DiBag.withLifetime(DiBag.withDisposal(() => ++calls, value => { disposed.push(value); }), 'transient');
  const bag = facade.begin().bind(token, provider).add({ consumer: DiBag.fromTokens([DiBag.optional(absent), token, DiBag.lazy(token), token], (missing, a, lazy, b) => ({ missing, a, lazy, b })) }).end();
  if (mode === 'prewalk') bag.resolve(token);
  const value = bag.resolve('consumer');
  assert.equal(value.missing, undefined);
  assert.deepEqual([value.a, value.b, calls], mode === 'prewalk' ? [2, 3, 3] : [1, 2, 2]);
  assert.equal(value.lazy(), mode === 'prewalk' ? 4 : 3);
  await bag.close(); await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(disposed, mode === 'prewalk' ? [4, 3, 2, 1] : [3, 2, 1]);
  console.log(JSON.stringify({ mode, calls, selectedValues: [value.a, value.b], events, disposed }));
}
