import { expect, test } from 'bun:test';
import { DiBag } from '../src';

test('exported tokens retarget private module consumers in forks', async () => {
  const key = Symbol('database');
  const database = DiBag.createToken(key).forService<{ read(): number }>();
  const feature = DiBag.createBuilder().withTokenService(database, () => ({ read: () => 1 })).withServices({ privateHandler: DiBag.createProviderFromFunction({ dependencies: [database], factoryFunction: db => ({ run: () => db.read() }) }),
      handler: ({ privateHandler }: { privateHandler: { run(): number } }) => privateHandler }).buildModule({ exportedServiceKeys: [database, 'handler'] });
  const root = DiBag.createBuilder().withInstalledModules([feature]).buildContainer();
  const child = root.createIndependentContainer([database], { [database.symbol]: () => ({ read: () => 9 }) });
  expect(root.resolve('handler').run()).toBe(1);
  expect(child.resolve('handler').run()).toBe(9);
  expect(child.resolve(database).read()).toBe(9);
  await Promise.all([root.close(), child.close()]);
});

test('private tokens get independent installations and dependency ordered cleanup', async () => {
  const key = Symbol('private'); const resource = DiBag.createToken(key).forService<{ id: number }>();
  const closed: string[] = []; let id = 0;
  const feature = DiBag.createBuilder().withTokenService(resource, DiBag.withDisposal(() => ({ id: ++id }), value => { closed.push(`resource:${value.id}`); })).withServices({ handler: DiBag.withDisposal(DiBag.createProviderFromFunction({ dependencies: [resource], factoryFunction: value => ({ id: value.id }) }), value => { closed.push(`handler:${value.id}`); }) }).buildModule({ exportedServiceKeys: ['handler'] });
  const bag = DiBag.createBuilder().withInstalledModules([feature.withRenamedExport({ currentExportKey: 'handler', newExportKey: 'first' })]).withInstalledModules([feature.withRenamedExport({ currentExportKey: 'handler', newExportKey: 'second' })]).buildContainer();
  expect(bag.resolve('first').id).toBe(1);
  expect(bag.resolve('second').id).toBe(2);
  await bag.close();
  expect(closed.indexOf('handler:1')).toBeLessThan(closed.indexOf('resource:1'));
  expect(closed.indexOf('handler:2')).toBeLessThan(closed.indexOf('resource:2'));
});

test('token bindings preserve source reuse, promise identity and public replacement', async () => {
  const key = Symbol('promise'); const secondKey = Symbol('second');
  const token = DiBag.createToken(key).forService<Promise<number>>(); const second = DiBag.createToken(secondKey).forService<Promise<number>>();
  const same = DiBag.createToken(key).forService<Promise<number>>(); const promise = Promise.resolve(4);
  const source = DiBag.withMetadata(() => promise, { static: { owner: 'team' } });
  const feature = DiBag.createBuilder().withTokenService(token, source).withServices({ consume: DiBag.createProviderFromFunction({ dependencies: [token], factoryFunction: value => value }) }).buildModule({ exportedServiceKeys: [token, 'consume'] });
  const replacement = Promise.resolve(9);
  const bag = DiBag.createBuilder().withInstalledModules([feature]).withTokenService(second, source).withReplacedService(token, () => replacement).buildContainer();
  expect(bag.resolve(same)).toBe(replacement);
  expect(bag.resolve('consume')).toBe(replacement);
  expect(bag.resolve(second)).toBe(promise);
  expect(bag.serviceSnapshot(second).registrationMetadata.owner).toBe('team');
  await bag.close();
});

test('fork snapshots mixed selection indices and reads only selected own overrides', async () => {
  const key = Symbol('value'); const value = DiBag.createToken(key).forService<number>();
  const bag = DiBag.createBuilder().withTokenService(value, () => 1).withServices({ named: () => 2 }).buildContainer();
  let unselectedReads = 0;
  const keys: readonly [typeof value, 'named'] = [value, 'named'];
  Object.defineProperty(keys, Symbol.iterator, { value: function* () { yield 'unselected'; } });
  const overrides = { [key]: () => 7, named: () => 8,
    get unselected() { unselectedReads++; throw new Error('must not read'); } };
  const child = bag.createIndependentContainer(keys, overrides);
  expect(child.resolve(value)).toBe(7); expect(child.resolve('named')).toBe(8); expect(unselectedReads).toBe(0);
  await Promise.all([bag.close(), child.close()]);
});

test('duplicate mixed overrides read each provider once and route its value through private consumers', async () => {
  const key = Symbol('resource'); const resource = DiBag.createToken(key).forService<{ read(): number }>();
  const closed: string[] = [];
  const feature = DiBag.createBuilder().withTokenService(resource, () => ({ read: () => 1 })).withServices({
      named: () => 2,
      privateConsumer: DiBag.createProviderFromFunction({ dependencies: [resource], factoryFunction: value => value.read }),
      handler: DiBag.withDisposal(
        ({ privateConsumer, named }: { privateConsumer(): number; named: number }) =>
          ({ token: privateConsumer(), named }),
        value => { closed.push(`handler:${value.token}:${value.named}`); },
      ),
    }).buildModule({ exportedServiceKeys: [resource, 'named', 'handler'] });
  const root = DiBag.createBuilder().withInstalledModules([feature]).buildContainer();
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
  const child = root.createIndependentContainer([resource, 'named', resource, 'named'], overrides);
  expect(reads).toEqual(['token', 'named']);
  expect(child.resolve('handler')).toEqual({ token: 2, named: 3 });
  expect(root.resolve('handler')).toEqual({ token: 1, named: 2 });
  await child.close();
  expect(closed[0]).toBe('handler:2:3');
  expect(closed).toContain('token:2');
  expect(closed).toContain('named:3');
  expect(closed).not.toContain('token:4');
  expect(closed).not.toContain('named:5');
  await root.close();
});

test('invalid token selections preflight before any selected override getter', async () => {
  const key = Symbol('value'); const token = DiBag.createToken(key).forService<number>();
  const bag = DiBag.createBuilder().withTokenService(token, () => 1).buildContainer(); let reads = 0;
  const overrides = { get [key]() { reads++; return () => 2; } };
  expect(() => Reflect.apply(bag.createIndependentContainer, bag, [[token, { ...token }], overrides])).toThrow('invalid token');
  expect(reads).toBe(0);
  expect(() => Reflect.apply(bag.createIndependentContainer, bag, [[token], Object.create(overrides)])).toThrow('missing createIndependentContainer replacement provider');
  expect(reads).toBe(0);
  expect(bag.resolve(token)).toBe(1); await bag.close();
});

test('runtime duplicate symbols reject atomically and leave builders reusable', async () => {
  const firstKey = Symbol.for('di-bag-task2-duplicate'); const secondKey = Symbol.for('di-bag-task2-duplicate');
  const first = DiBag.createToken(firstKey).forService<number>(); const second = DiBag.createToken(secondKey).forService<number>();
  const builder = DiBag.createBuilder().withTokenService(first, () => 1);
  expect(() => builder.withTokenService(second, () => 2)).toThrow('duplicate');
  const module = DiBag.createBuilder().withTokenService(first, () => 3);
  expect(() => module.withTokenService(second, () => 4)).toThrow('duplicate');
  const bag = builder.buildContainer(); expect(bag.resolve(first)).toBe(1);
  const installed = DiBag.createBuilder().withInstalledModules([module.buildModule({ exportedServiceKeys: [first] })]).buildContainer(); expect(installed.resolve(first)).toBe(3);
  await Promise.all([bag.close(), installed.close()]);
});
