import { expect, test } from 'bun:test';
import { DiBag } from '../src/node';

test('exported tokens retarget private module consumers in forks', async () => {
  const key = Symbol('database');
  const database = DiBag.token(key).of<{ read(): number }>();
  const feature = DiBag.createModuleBuilder().register(database, () => ({ read: () => 1 })).register({ privateHandler: DiBag.fromFunction([database], db => ({ run: () => db.read() })),
      handler: ({ privateHandler }: { privateHandler: { run(): number } }) => privateHandler }).buildModule([database, 'handler']);
  const root = DiBag.createBuilder().installModule(feature).build();
  const child = root.fork([database], { [database.key]: () => ({ read: () => 9 }) });
  expect(root.resolve('handler').run()).toBe(1);
  expect(child.resolve('handler').run()).toBe(9);
  expect(child.resolve(database).read()).toBe(9);
  await Promise.all([root.close(), child.close()]);
});

test('private tokens get independent installations and dependency ordered cleanup', async () => {
  const key = Symbol('private'); const resource = DiBag.token(key).of<{ id: number }>();
  const closed: string[] = []; let id = 0;
  const feature = DiBag.createModuleBuilder().register(resource, DiBag.withDisposal(() => ({ id: ++id }), value => { closed.push(`resource:${value.id}`); })).register({ handler: DiBag.withDisposal(DiBag.fromFunction([resource], value => ({ id: value.id })), value => { closed.push(`handler:${value.id}`); }) }).buildModule(['handler']);
  const bag = DiBag.createBuilder().installModule(feature.renameExport('handler', 'first')).installModule(feature.renameExport('handler', 'second')).build();
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
  const source = DiBag.withMetadata(() => promise, { static: { owner: 'team' } });
  const feature = DiBag.createModuleBuilder().register(token, source).register({ consume: DiBag.fromFunction([token], value => value) }).buildModule([token, 'consume']);
  const replacement = Promise.resolve(9);
  const bag = DiBag.createBuilder().installModule(feature).register(second, source).replace(token, () => replacement).build();
  expect(bag.resolve(same)).toBe(replacement);
  expect(bag.resolve('consume')).toBe(replacement);
  expect(bag.resolve(second)).toBe(promise);
  expect(bag.inspect(second).registrationMetadata.owner).toBe('team');
  await bag.close();
});

test('fork snapshots mixed selection indices and reads only selected own overrides', async () => {
  const key = Symbol('value'); const value = DiBag.token(key).of<number>();
  const bag = DiBag.createBuilder().register(value, () => 1).register({ named: () => 2 }).build();
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
  const feature = DiBag.createModuleBuilder().register(resource, () => ({ read: () => 1 })).register({
      named: () => 2,
      privateConsumer: DiBag.fromFunction([resource], value => value.read),
      handler: DiBag.withDisposal(
        ({ privateConsumer, named }: { privateConsumer(): number; named: number }) =>
          ({ token: privateConsumer(), named }),
        value => { closed.push(`handler:${value.token}:${value.named}`); },
      ),
    }).buildModule([resource, 'named', 'handler']);
  const root = DiBag.createBuilder().installModule(feature).build();
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
  const bag = DiBag.createBuilder().register(token, () => 1).build(); let reads = 0;
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
  const builder = DiBag.createBuilder().register(first, () => 1);
  expect(() => builder.register(second, () => 2)).toThrow('duplicate');
  const module = DiBag.createModuleBuilder().register(first, () => 3);
  expect(() => module.register(second, () => 4)).toThrow('duplicate');
  const bag = builder.build(); expect(bag.resolve(first)).toBe(1);
  const installed = DiBag.createBuilder().installModule(module.buildModule([first])).build(); expect(installed.resolve(first)).toBe(3);
  await Promise.all([bag.close(), installed.close()]);
});
