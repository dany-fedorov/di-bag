import { expect, test } from 'bun:test';
import { DiBag } from '../src/di-bag';
import { deferred } from './helpers';

test('withDisposal exposes the value and closes each resolved instance once', async () => {
  const closed: number[] = [];
  const bag = DiBag.begin()
    .add({
      resource: DiBag.withDisposal(
        () => 42,
        (value) => {
          closed.push(value);
        },
      ),
    })
    .end();
  expect(bag.resolve('resource')).toBe(42);
  expect(bag.resolve('resource')).toBe(42);
  const closing = bag.close();
  expect(bag.close()).toBe(closing);
  await closing;
  await bag.close();
  expect(closed).toEqual([42]);
});

test('ordinary values are borrowed even when they expose disposal methods', async () => {
  let closed = 0;
  const value = {
    create: () => 42,
    dispose: () => {
      closed++;
    },
  };
  const bag = DiBag.begin()
    .add({ value: () => value })
    .end();
  expect(bag.resolve('value')).toBe(value);
  await bag.close();
  expect(closed).toBe(0);
});

test('unresolved and failed factories have no disposal', async () => {
  const disposed: string[] = [];
  const bag = DiBag.begin()
    .add({
      unused: DiBag.withDisposal(
        () => 'unused',
        (value) => {
          disposed.push(value);
        },
      ),
      failed: DiBag.withDisposal(
        (): string => {
          throw new Error('acquire');
        },
        (value) => {
          disposed.push(value);
        },
      ),
    })
    .end();
  expect(() => bag.resolve('failed')).toThrow('acquire');
  await bag.close();
  expect(disposed).toEqual([]);
});

test('throwing then inspection rejects each acquisition until a synchronous retry succeeds', async () => {
  const failure = new Error('then getter');
  let created = 0;
  const disposed: number[] = [];
  const bag = DiBag.begin()
    .add({
      resource: DiBag.withDisposal(
        () => {
          const id = ++created;
          return {
            id,
            get then(): undefined {
              if (id < 3) throw failure;
              return undefined;
            },
          };
        },
        (resource) => {
          disposed.push(resource.id);
        },
      ),
    })
    .end();
  for (let attempt = 0; attempt < 2; attempt++) {
    let caught: unknown;
    try {
      bag.resolve('resource');
    } catch (error) {
      caught = error;
    }
    expect(caught).toBe(failure);
  }
  expect(disposed).toEqual([]);
  const resource = bag.resolve('resource');
  expect(resource.id).toBe(3);
  expect(bag.resolve('resource')).toBe(resource);
  expect(created).toBe(3);
  await bag.close();
  await bag.close();
  expect(disposed).toEqual([3]);
});

test('a PromiseLike with a throwing then getter never reaches the fulfilled-value disposer', async () => {
  const failure = new Error('then getter');
  class Unobservable implements PromiseLike<{ id: number }> {
    get then(): PromiseLike<{ id: number }>['then'] {
      throw failure;
    }
  }
  let created = 0;
  const disposed: number[] = [];
  const bag = DiBag.begin()
    .add({
      resource: DiBag.withDisposal(
        () => {
          created++;
          return new Unobservable();
        },
        (resource) => {
          disposed.push(resource.id);
        },
      ),
    })
    .end();
  for (let attempt = 0; attempt < 2; attempt++) {
    let caught: unknown;
    try {
      bag.resolve('resource');
    } catch (error) {
      caught = error;
    }
    expect(caught).toBe(failure);
  }
  expect(created).toBe(2);
  await bag.close();
  expect(disposed).toEqual([]);
});

test('native Promise observer setup failures allow retry and preserve accepted Promise identity', async () => {
  const failure = new Error('constructor getter');
  const unobservable = Promise.resolve({ id: 1 });
  Object.defineProperty(unobservable, 'constructor', {
    get() {
      throw failure;
    },
  });
  const resource = { id: 2 };
  const accepted = Promise.resolve(resource);
  let created = 0;
  const disposed: { id: number }[] = [];
  const bag = DiBag.begin()
    .add({
      resource: DiBag.withDisposal(
        () => (++created < 3 ? unobservable : accepted),
        (value) => {
          disposed.push(value);
        },
      ),
    })
    .end();
  for (let attempt = 0; attempt < 2; attempt++) {
    let caught: unknown;
    try {
      bag.resolve('resource');
    } catch (error) {
      caught = error;
    }
    expect(caught).toBe(failure);
  }
  expect(disposed).toEqual([]);
  expect(bag.resolve('resource')).toBe(accepted);
  expect(bag.resolve('resource')).toBe(accepted);
  expect(created).toBe(3);
  await bag.close();
  expect(disposed).toHaveLength(1);
  expect(disposed[0]).toBe(resource);
});

test('native Promise ownership observation ignores an own then override', async () => {
  const resource = { id: 'real' };
  const original = Promise.resolve(resource);
  const disposed: typeof resource[] = [];
  let customThenCalled = false;
  original.then = (fulfilled) => {
    customThenCalled = true;
    fulfilled?.({ id: 'not-the-fulfilled-resource' });
    throw new Error('custom then');
  };
  const bag = DiBag.begin().add({
    resource: DiBag.withDisposal(() => original, value => { disposed.push(value); }),
  }).end();
  expect(bag.resolve('resource')).toBe(original);
  await bag.close();
  expect(customThenCalled).toBe(false);
  expect(disposed).toHaveLength(1);
  expect(disposed[0]).toBe(resource);
});

test('structural thenable ownership accepts fulfillment before a subsequent throw', async () => {
  const resource = { id: 'real' };
  const original: PromiseLike<typeof resource> = {
    then(fulfilled) {
      fulfilled?.(resource);
      throw new Error('after fulfillment');
    },
  };
  const disposed: typeof resource[] = [];
  const bag = DiBag.begin().add({
    resource: DiBag.withDisposal(() => original, value => { disposed.push(value); }),
  }).end();
  expect(bag.resolve('resource')).toBe(original);
  await bag.close();
  expect(disposed).toHaveLength(1);
  expect(disposed[0]).toBe(resource);
});

test('rejected structural thenables retry and dispose only the fulfilled retry', async () => {
  const failure = new Error('rejected thenable');
  const first = Promise.reject<number>(failure);
  const rejected: PromiseLike<number> = { then: first.then.bind(first) };
  const accepted = Promise.resolve(42);
  let created = 0;
  const disposed: number[] = [];
  const bag = DiBag.begin()
    .add({
      resource: DiBag.withDisposal(
        () => (++created === 1 ? rejected : accepted),
        (value) => {
          disposed.push(value);
        },
      ),
    })
    .end();
  expect(bag.resolve('resource')).toBe(rejected);
  await expect(Promise.resolve(rejected)).rejects.toBe(failure);
  expect(bag.resolve('resource')).toBe(accepted);
  await bag.close();
  expect(created).toBe(2);
  expect(disposed).toEqual([42]);
});

test('cleanup runs in reverse acquisition order through unmanaged intermediates', async () => {
  const disposed: string[] = [];
  const bag = DiBag.begin()
    .add({
      db: DiBag.withDisposal(
        () => 'db',
        (value) => {
          disposed.push(value);
        },
      ),
      middle: ({ db }: { db: string }) => db,
      server: DiBag.withDisposal(
        ({ middle }: { middle: string }) => `${middle}-server`,
        (value) => {
          disposed.push(value);
        },
      ),
      independent: DiBag.withDisposal(
        () => 'independent',
        (value) => {
          disposed.push(value);
        },
      ),
    })
    .end();
  bag.resolve('server');
  bag.resolve('independent');
  await bag.close();
  expect(disposed).toEqual(['independent', 'db-server', 'db']);
});

test('async disposers are awaited sequentially and receive fulfilled values', async () => {
  const gate = deferred<void>();
  const disposed: string[] = [];
  const bag = DiBag.begin()
    .add({
      first: DiBag.withDisposal(
        async () => 'first',
        (value) => {
          disposed.push(value);
        },
      ),
      second: DiBag.withDisposal(
        () => 'second',
        async (value) => {
          disposed.push(`${value}:start`);
          await gate.promise;
          disposed.push(`${value}:end`);
        },
      ),
    })
    .end();
  await bag.resolve('first');
  bag.resolve('second');
  const closing = bag.close();
  await Promise.resolve();
  expect(disposed).toEqual(['second:start']);
  gate.resolve();
  await closing;
  expect(disposed).toEqual(['second:start', 'second:end', 'first']);
});

test('dependency ordering wins over async completion order', async () => {
  const gate = deferred<string>();
  const disposed: string[] = [];
  const bag = DiBag.begin()
    .add({
      db: DiBag.withDisposal(
        () => gate.promise,
        (value) => {
          disposed.push(value);
        },
      ),
      server: DiBag.withDisposal(
        ({ db }: { db: Promise<string> }) => ({ db }),
        () => {
          disposed.push('server');
        },
      ),
    })
    .end();
  const server = bag.resolve('server');
  gate.resolve('db');
  await server.db;
  await bag.close();
  expect(disposed).toEqual(['server', 'db']);
});

test('close drains pending factories and dependencies discovered after await', async () => {
  const gate = deferred<void>();
  const disposed: string[] = [];
  const bag = DiBag.begin()
    .add({
      db: DiBag.withDisposal(
        async () => 21,
        () => {
          disposed.push('db');
        },
      ),
      service: DiBag.withDisposal(
        async (deps: { db: Promise<number> }) => {
          await gate.promise;
          return (await deps.db) * 2;
        },
        () => {
          disposed.push('service');
        },
      ),
    })
    .end();
  const value = bag.resolve('service');
  const closing = bag.close();
  expect(() => bag.resolve('db')).toThrow(/clos/);
  expect(() => bag.fork()).toThrow(/clos/);
  gate.resolve();
  expect(await value).toBe(42);
  await closing;
  expect(disposed).toEqual(['service', 'db']);
});

test('pending acquisition failure does not stop cleanup of other resources', async () => {
  const gate = deferred<string>();
  const disposed: string[] = [];
  const bag = DiBag.begin()
    .add({
      good: DiBag.withDisposal(
        () => 'good',
        (value) => {
          disposed.push(value);
        },
      ),
      bad: DiBag.withDisposal(
        () => gate.promise,
        (value) => {
          disposed.push(value);
        },
      ),
    })
    .end();
  bag.resolve('good');
  const bad = bag.resolve('bad');
  const closing = bag.close();
  gate.reject(new Error('acquire'));
  await expect(bad).rejects.toThrow('acquire');
  await closing;
  expect(disposed).toEqual(['good']);
});

test('every disposer runs and close rethrows the first cleanup failure', async () => {
  const disposed: string[] = [];
  const firstError = new Error('first cleanup failure');
  const bag = DiBag.begin()
    .add({
      a: DiBag.withDisposal(
        () => 'a',
        (value) => {
          disposed.push(value);
          throw new Error('later');
        },
      ),
      b: DiBag.withDisposal(
        () => 'b',
        async (value) => {
          disposed.push(value);
          throw firstError;
        },
      ),
      c: DiBag.withDisposal(
        () => 'c',
        (value) => {
          disposed.push(value);
        },
      ),
    })
    .end();
  bag.resolve('a');
  bag.resolve('b');
  bag.resolve('c');
  const closing = bag.close();
  await expect(closing).rejects.toBe(firstError);
  expect(bag.close()).toBe(closing);
  expect(disposed).toEqual(['c', 'b', 'a']);
  expect(() => bag.resolve('a')).toThrow(/clos/);
});

test('throwing undefined still rejects close and does not skip other disposers', async () => {
  let cleaned = false;
  const bag = DiBag.begin()
    .add({
      a: DiBag.withDisposal(
        () => 1,
        () => {
          cleaned = true;
        },
      ),
      b: DiBag.withDisposal(
        () => 2,
        () => {
          throw undefined;
        },
      ),
    })
    .end();
  bag.resolve('a');
  bag.resolve('b');
  let rejected = false;
  try {
    await bag.close();
  } catch (error) {
    rejected = true;
    expect(error).toBeUndefined();
  }
  expect(rejected).toBe(true);
  expect(cleaned).toBe(true);
});

test('parent and forks own independent instances and borrowed overrides stay borrowed', async () => {
  let id = 0;
  const disposed: number[] = [];
  const bag = DiBag.begin()
    .add({
      value: DiBag.withDisposal(
        () => ({ id: ++id }),
        (value) => {
          disposed.push(value.id);
        },
      ),
    })
    .end();
  const fork = bag.fork();
  const borrowed = bag.fork(['value'], { value: () => ({ id: 99 }) });
  expect(bag.resolve('value').id).toBe(1);
  expect(fork.resolve('value').id).toBe(2);
  expect(borrowed.resolve('value').id).toBe(99);
  await bag.close();
  expect(fork.resolve('value').id).toBe(2);
  await fork.close();
  await borrowed.close();
  expect(disposed).toEqual([1, 2]);
});

test('an owned override can replace an ordinary factory', async () => {
  let disposed = 0;
  const bag = DiBag.begin()
    .add({ value: () => 1 })
    .end();
  const fork = bag.fork(['value'], {
    value: DiBag.withDisposal(
      () => 7,
      (value) => {
        disposed = value;
      },
    ),
  });
  expect(fork.resolve('value')).toBe(7);
  await fork.close();
  expect(disposed).toBe(7);
  await bag.close();
});

test('pending factories can create a chain of synchronous dependencies during close', async () => {
  const gate = deferred<void>();
  const bag = DiBag.begin()
    .add({
      base: () => 21,
      middle: ({ base }: { base: number }) => base * 2,
      result: async (deps: { middle: number }) => {
        await gate.promise;
        return deps.middle;
      },
    })
    .end();
  const result = bag.resolve('result');
  const closing = bag.close();
  gate.resolve();
  expect(await result).toBe(42);
  await closing;
});
