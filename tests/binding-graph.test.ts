import { expect, test } from 'bun:test';
import { DiBag } from '../src/node';
import { BindingGraph } from '../src/runtime';
import { BagRuntime } from './runtime-context';
import type { BindingDescription } from '../src/runtime';
import { deferred } from './helpers';

function graph(bindings: BindingDescription[], slots: [string | symbol, symbol][]): BindingGraph {
  return new BindingGraph({
    bindings: new Map(bindings.map(binding => [binding.id, binding])),
    publicSlots: new Map(slots),
  });
}

test('private bindings with the same label have distinct memoized identities', async () => {
  const leftConnection = { side: 'left' };
  const rightConnection = { side: 'right' };
  const leftId = Symbol('connection');
  const rightId = Symbol('connection');
  const left = Symbol('left');
  const right = Symbol('right');
  const alias = Symbol('alias');
  let leftCreated = 0;
  let rightCreated = 0;
  let serviceCreated = 0;
  const runtime = new BagRuntime(graph([
    { id: leftId, label: 'connection', registration: () => {
      leftCreated++;
      return leftConnection;
    }, localNames: new Map() },
    { id: rightId, label: 'connection', registration: () => {
      rightCreated++;
      return rightConnection;
    }, localNames: new Map() },
    { id: left, label: 'left', registration: ({ connection }: { connection: typeof leftConnection }) => {
      serviceCreated++;
      return { connection };
    }, localNames: new Map([['connection', { kind: 'private', id: leftId }]]) },
    { id: right, label: 'right', registration: ({ connection }: { connection: typeof rightConnection }) => ({ connection }),
      localNames: new Map([['connection', { kind: 'private', id: rightId }]]) },
    { id: alias, label: 'alias', registration: ({ selected }: { selected: { connection: typeof leftConnection } }) => selected,
      localNames: new Map([['selected', { kind: 'public', key: 'left' }]]) },
  ], [['left', left], ['right', right], ['alias', alias]]));
  expect(runtime.resolve('left')).toEqual({ connection: leftConnection });
  expect(runtime.resolve('right')).toEqual({ connection: rightConnection });
  expect(leftConnection).not.toBe(rightConnection);
  expect(runtime.resolve('left')).toBe(runtime.resolve('left'));
  expect(runtime.resolve('alias')).toBe(runtime.resolve('left'));
  expect([leftCreated, rightCreated, serviceCreated]).toEqual([1, 1, 1]);
  expect(() => runtime.resolve('connection')).toThrow('is not registered');
  await runtime.close();
});

test('an owned private dependency closes after its public dependent', async () => {
  const connection = Symbol('connection');
  const dependent = Symbol('dependent');
  const disposed: string[] = [];
  const runtime = new BagRuntime(graph([
    { id: connection, label: 'connection', registration: DiBag.withDisposal(() => 'private', value => { disposed.push(value); }), localNames: new Map() },
    { id: dependent, label: 'dependent', registration: DiBag.withDisposal(
      ({ connection }: { connection: string }) => {
        expect(connection).toBe('private');
        return 'dependent';
      }, value => { disposed.push(value); }),
      localNames: new Map([['connection', { kind: 'private', id: connection }]]) },
  ], [['dependent', dependent]]));
  runtime.resolve('dependent');
  await runtime.close();
  expect(disposed).toEqual(['dependent', 'private']);
});

test('private Promise-valued bindings preserve their original exposed identity', async () => {
  const resource = Symbol('resource');
  const dependent = Symbol('dependent');
  const original = Promise.resolve({ id: 'real' });
  const runtime = new BagRuntime(graph([
    { id: resource, label: 'resource', registration: () => original, localNames: new Map() },
    { id: dependent, label: 'dependent', registration: ({ resource }: { resource: typeof original }) => resource,
      localNames: new Map([['resource', { kind: 'private', id: resource }]]) },
  ], [['dependent', dependent]]));
  expect(runtime.resolve('dependent')).toBe(original);
  await runtime.close();
});

test('graph snapshots preserve lexical private refs while forks use replaced public slots', async () => {
  const privateId = Symbol('connection');
  const publicId = Symbol('connection');
  const service = Symbol('service');
  const privateConnections: { scope: string }[] = [];
  const localNames = new Map([
    ['privateConnection', { kind: 'private' as const, id: privateId }],
  ]);
  const description = graph([
    { id: privateId, label: 'connection', registration: () => {
      const connection = { scope: 'private' };
      privateConnections.push(connection);
      return connection;
    }, localNames: new Map() },
    { id: publicId, label: 'connection', registration: () => ({ scope: 'parent' }), localNames: new Map() },
    { id: service, label: 'service', registration: (deps: {
      privateConnection: { scope: string };
      connection: { scope: string };
    }) => ({ private: deps.privateConnection, public: deps.connection }), localNames },
  ], [['connection', publicId], ['service', service]]);
  localNames.set('privateConnection', { kind: 'private', id: publicId });
  const parent = new BagRuntime(description);
  const fork = new BagRuntime(description.withPublicRegistrations({ connection: () => ({ scope: 'fork' }) }));
  expect(parent.resolve('service')).toEqual({ private: { scope: 'private' }, public: { scope: 'parent' } });
  expect(fork.resolve('service')).toEqual({ private: { scope: 'private' }, public: { scope: 'fork' } });
  expect(parent.resolve('service')).not.toBe(fork.resolve('service'));
  expect(privateConnections).toHaveLength(2);
  expect(privateConnections[0]).not.toBe(privateConnections[1]);
  await parent.close();
  expect(fork.resolve('service')).toEqual({ private: { scope: 'private' }, public: { scope: 'fork' } });
  await fork.close();
});

test('batch public bindings preserve ordered duplicates and retained private identities', async () => {
  const publicKey = Symbol('public');
  const privateId = Symbol('private');
  const publicId = Symbol('parent');
  const consumerId = Symbol('consumer');
  const original = graph([
    { id: privateId, label: 'private', registration: () => 'private', localNames: new Map() },
    { id: publicId, label: 'public', registration: () => 'parent', localNames: new Map() },
    { id: consumerId, label: 'consumer', registration: (deps: { privateValue: string; publicValue: string }) =>
      ({ privateValue: deps.privateValue, publicValue: deps.publicValue }),
      localNames: new Map([
        ['privateValue', { kind: 'private', id: privateId }],
        ['publicValue', { kind: 'public', key: publicKey }],
      ]) },
  ], [[publicKey, publicId], ['consumer', consumerId]]);
  const batch = original.withPublicBindings([
    [publicKey, () => 'first'],
    ['named', () => 'named'],
    [publicKey, () => 'final'],
  ]);
  const parent = new BagRuntime(original);
  const child = new BagRuntime(batch);
  expect(parent.resolve(publicKey)).toBe('parent');
  expect(child.resolve(publicKey)).toBe('final');
  expect(child.resolve('named')).toBe('named');
  expect(child.resolve('consumer')).toEqual({ privateValue: 'private', publicValue: 'final' });
  await Promise.all([parent.close(), child.close()]);
});

test('an empty public binding batch preserves immutable graph identity', () => {
  const original = graph([], []);
  expect(original.withPublicBindings([])).toBe(original);
});

test('mutating graph input maps cannot change public lookup or binding descriptions', async () => {
  const id = Symbol('value');
  const description = { id, label: 'value', registration: () => 42, localNames: new Map() };
  const bindings = new Map([[id, description]]);
  const publicSlots = new Map([['value', id]]);
  const immutable = new BindingGraph({ bindings, publicSlots });
  bindings.clear();
  publicSlots.clear();
  description.registration = () => 0;
  const runtime = new BagRuntime(immutable);
  expect(runtime.resolve('value')).toBe(42);
  await runtime.close();
});

test('cycles through private aliases discovered after await show binding labels', async () => {
  const a = Symbol();
  const b = Symbol();
  const gate = deferred<void>();
  const runtime = new BagRuntime(graph([
    { id: a, label: 'left', registration: async (deps: { next: Promise<unknown> }) => {
      await gate.promise;
      return deps.next;
    }, localNames: new Map([['next', { kind: 'private', id: b }]]) },
    { id: b, label: 'right', registration: async (deps: { next: Promise<unknown> }) => {
      await gate.promise;
      return deps.next;
    }, localNames: new Map([['next', { kind: 'private', id: a }]]) },
  ], [['entry', a]]));
  const pending = runtime.resolve('entry');
  gate.resolve();
  await expect(pending).rejects.toThrow('cycle: left -> right -> left');
  await runtime.close();
});
