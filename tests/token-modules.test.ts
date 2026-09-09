import { expect, test } from 'bun:test';
import { DiBag } from '../src/node';

test('exported tokens retarget private module consumers in forks', async () => {
  const key = Symbol('database');
  const database = DiBag.token(key).of<{ read(): number }>();
  const feature = DiBag.module().bind(database, () => ({ read: () => 1 }))
    .add({ privateHandler: DiBag.fromTokens([database], db => ({ run: () => db.read() })),
      handler: ({ privateHandler }: { privateHandler: { run(): number } }) => privateHandler })
    .exports([database, 'handler']);
  const root = DiBag.begin().install(feature).end();
  const child = root.fork([database], { [database.key]: () => ({ read: () => 9 }) });
  expect(root.resolve('handler').run()).toBe(1);
  expect(child.resolve('handler').run()).toBe(9);
  expect(child.resolve(database).read()).toBe(9);
  await Promise.all([root.close(), child.close()]);
});

test('private tokens get independent installations and dependency ordered cleanup', async () => {
  const key = Symbol('private'); const resource = DiBag.token(key).of<{ id: number }>();
  const closed: string[] = []; let id = 0;
  const feature = DiBag.module().bind(resource, DiBag.withDisposal(() => ({ id: ++id }), value => { closed.push(`resource:${value.id}`); }))
    .add({ handler: DiBag.withDisposal(DiBag.fromTokens([resource], value => ({ id: value.id })), value => { closed.push(`handler:${value.id}`); }) })
    .exports(['handler']);
  const bag = DiBag.begin().install(feature.rename('handler', 'first')).install(feature.rename('handler', 'second')).end();
  expect(bag.resolve('first').id).toBe(1);
  expect(bag.resolve('second').id).toBe(2);
  await bag.close();
  expect(closed.indexOf('handler:1')).toBeLessThan(closed.indexOf('resource:1'));
  expect(closed.indexOf('handler:2')).toBeLessThan(closed.indexOf('resource:2'));
});

test('token bindings preserve source reuse, promise identity and public replacement', async () => {
  const key = Symbol('promise'); const secondKey = Symbol('second');
  const token = DiBag.token(key).of<Promise<number>>(); const second = DiBag.token(secondKey).of<Promise<number>>();
  const same = DiBag.token(key).of<Promise<number>>(); const promise = Promise.resolve(4);
  const source = DiBag.withMetadata(() => promise, { owner: 'team' });
  const feature = DiBag.module().bind(token, source).add({ consume: DiBag.fromTokens([token], value => value) }).exports([token, 'consume']);
  const replacement = Promise.resolve(9);
  const bag = DiBag.begin().install(feature).bind(second, source).replace(token, () => replacement).end();
  expect(bag.resolve(same)).toBe(replacement);
  expect(bag.resolve('consume')).toBe(replacement);
  expect(bag.resolve(second)).toBe(promise);
  expect(bag.inspect(second).metadata.owner).toBe('team');
  await bag.close();
});

test('fork snapshots mixed selection indices and reads only selected own overrides', async () => {
  const key = Symbol('value'); const value = DiBag.token(key).of<number>();
  const bag = DiBag.begin().bind(value, () => 1).add({ named: () => 2 }).end();
  let unselectedReads = 0;
  const keys: readonly [typeof value, 'named'] = [value, 'named'];
  Object.defineProperty(keys, Symbol.iterator, { value: function* () { yield 'unselected'; } });
  const overrides = { [key]: () => 7, named: () => 8,
    get unselected() { unselectedReads++; throw new Error('must not read'); } };
  const child = bag.fork(keys, overrides);
  expect(child.resolve(value)).toBe(7); expect(child.resolve('named')).toBe(8); expect(unselectedReads).toBe(0);
  await Promise.all([bag.close(), child.close()]);
});

test('duplicate mixed overrides keep getter order and route final values through private consumers', async () => {
  const key = Symbol('resource'); const resource = DiBag.token(key).of<{ read(): number }>();
  const closed: string[] = [];
  const feature = DiBag.module()
    .bind(resource, () => ({ read: () => 1 }))
    .add({
      named: () => 2,
      privateConsumer: DiBag.fromTokens([resource], value => value.read),
      handler: DiBag.withDisposal(
        ({ privateConsumer, named }: { privateConsumer(): number; named: number }) =>
          ({ token: privateConsumer(), named }),
        value => { closed.push(`handler:${value.token}:${value.named}`); },
      ),
    })
    .exports([resource, 'named', 'handler']);
  const root = DiBag.begin().install(feature).end();
  const reads: string[] = [];
  let tokenValue = 2; let namedValue = 3;
  const overrides = {
    get [key]() {
      reads.push('token'); const value = tokenValue; tokenValue += 2;
      return DiBag.withDisposal(() => ({ read: () => value }), () => { closed.push(`token:${value}`); });
    },
    get named() {
      reads.push('named'); const value = namedValue; namedValue += 2;
      return DiBag.withDisposal(() => value, () => { closed.push(`named:${value}`); });
    },
  };
  const child = root.fork([resource, 'named', resource, 'named'], overrides);
  expect(reads).toEqual(['token', 'named', 'token', 'named']);
  expect(child.resolve('handler')).toEqual({ token: 4, named: 5 });
  expect(root.resolve('handler')).toEqual({ token: 1, named: 2 });
  await child.close();
  expect(closed[0]).toBe('handler:4:5');
  expect(closed).toContain('token:4');
  expect(closed).toContain('named:5');
  expect(closed).not.toContain('token:2');
  expect(closed).not.toContain('named:3');
  await root.close();
});

test('invalid token selections preflight before any selected override getter', async () => {
  const key = Symbol('value'); const token = DiBag.token(key).of<number>();
  const bag = DiBag.begin().bind(token, () => 1).end(); let reads = 0;
  const overrides = { get [key]() { reads++; return () => 2; } };
  expect(() => Reflect.apply(bag.fork, bag, [[token, { ...token }], overrides])).toThrow('invalid token');
  expect(reads).toBe(0);
  expect(() => Reflect.apply(bag.fork, bag, [[token], Object.create(overrides)])).toThrow('missing override');
  expect(reads).toBe(0);
  expect(bag.resolve(token)).toBe(1); await bag.close();
});

test('runtime duplicate symbols reject atomically and leave builders reusable', async () => {
  const firstKey = Symbol.for('di-bag-task2-duplicate'); const secondKey = Symbol.for('di-bag-task2-duplicate');
  const first = DiBag.token(firstKey).of<number>(); const second = DiBag.token(secondKey).of<number>();
  const builder = DiBag.begin().bind(first, () => 1);
  expect(() => builder.bind(second, () => 2)).toThrow('duplicate');
  const module = DiBag.module().bind(first, () => 3);
  expect(() => module.bind(second, () => 4)).toThrow('duplicate');
  const bag = builder.end(); expect(bag.resolve(first)).toBe(1);
  const installed = DiBag.begin().install(module.exports([first])).end(); expect(installed.resolve(first)).toBe(3);
  await Promise.all([bag.close(), installed.close()]);
});
