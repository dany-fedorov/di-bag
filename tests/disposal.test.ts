import { expect, test } from 'bun:test';
import { DiBag } from '../src/node';
import { DiBagCleanupError } from '../src';
import { deferred } from './helpers';

test('disposal callbacks receive the owned value without a receiver', async () => {
  const disposed: number[] = [];
  function dispose(this: unknown, value: number) {
    expect(this).toBeUndefined();
    disposed.push(value);
  }
  const bag = DiBag.createBuilder().register({ resource: DiBag.withDisposal(() => 42, dispose) }).build();
  bag.resolve('resource');
  await bag.close();
  expect(disposed).toEqual([42]);
});

test('withDisposal exposes the value and closes each resolved instance once', async () => {
  const closed: number[] = [];
  const bag = DiBag.createBuilder().register({
      resource: DiBag.withDisposal(
        () => 42,
        (value) => {
          closed.push(value);
        },
      ),
    }).build();
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
  const bag = DiBag.createBuilder().register({ value: () => value }).build();
  expect(bag.resolve('value')).toBe(value);
  await bag.close();
  expect(closed).toBe(0);
});

test('unresolved and failed factories have no disposal', async () => {
  const disposed: string[] = [];
  const bag = DiBag.createBuilder().register({
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
    }).build();
  expect(() => bag.resolve('failed')).toThrow('acquire');
  await bag.close();
  expect(disposed).toEqual([]);
});

test('throwing then inspection rejects each acquisition until a synchronous retry succeeds', async () => {
  const failure = new Error('then getter');
  let created = 0;
  const disposed: number[] = [];
  const bag = DiBag.createBuilder().register({
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
    }).build();
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
  const bag = DiBag.createBuilder().register({
      resource: DiBag.withDisposal(
        () => {
          created++;
          return new Unobservable();
        },
        (resource) => {
          disposed.push(resource.id);
        },
      ),
    }).build();
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
  const bag = DiBag.createBuilder().register({
      resource: DiBag.withDisposal(
        () => (++created < 3 ? unobservable : accepted),
        (value) => {
          disposed.push(value);
        },
      ),
    }).build();
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
  const bag = DiBag.createBuilder().register({
    resource: DiBag.withDisposal(() => original, value => { disposed.push(value); }),
  }).build();
  expect(bag.resolve('resource')).toBe(original);
  await bag.close();
  expect(customThenCalled).toBe(false);
  expect(disposed).toHaveLength(1);
  expect(disposed[0]).toBe(resource);
});

test('native Promise subclass ownership ignores an own then override', async () => {
  class ServicePromise<T> extends Promise<T> {}
  const resource = { id: 'real' };
  const substituted = { id: 'substituted' };
  const original = ServicePromise.resolve(resource);
  const disposed: typeof resource[] = [];
  let customThenCalls = 0;
  original.then = fulfilled => {
    customThenCalls++;
    fulfilled?.(substituted);
    throw new Error('custom then');
  };
  const bag = DiBag.createBuilder().register({
    resource: DiBag.withDisposal(() => original, value => { disposed.push(value); }),
  }).build();
  expect(bag.resolve('resource')).toBe(original);
  await bag.close();
  expect(customThenCalls).toBe(0);
  expect(disposed).toHaveLength(1);
  expect(disposed[0]).toBe(resource);
});

for (const stage of ['constructor', 'species'] as const) {
  test(`native ${stage} TypeError preserves the original failure and permits retry`, async () => {
    const failure = new TypeError(`${stage} setup`);
    const unobservable = Promise.resolve({ id: 1 });
    let customThenCalls = 0;
    unobservable.then = () => { customThenCalls++; throw new Error('must not assimilate'); };
    Object.defineProperty(unobservable, 'constructor', stage === 'constructor'
      ? { get() { throw failure; } }
      : { value: { get [Symbol.species]() { throw failure; } } });
    const resource = { id: 2 };
    const accepted = Promise.resolve(resource);
    let created = 0;
    const disposed: typeof resource[] = [];
    const bag = DiBag.createBuilder().register({
      resource: DiBag.withDisposal(() => ++created < 3 ? unobservable : accepted,
        value => { disposed.push(value); }),
    }).build();
    for (let attempt = 0; attempt < 2; attempt++) {
      let caught: unknown;
      try { bag.resolve('resource'); } catch (error) { caught = error; }
      expect(caught).toBe(failure);
    }
    expect(bag.resolve('resource')).toBe(accepted);
    expect(customThenCalls).toBe(0);
    expect(disposed).toEqual([]);
    await bag.close();
    expect(created).toBe(3);
    expect(disposed).toHaveLength(1);
    expect(disposed[0]).toBe(resource);
  });
}

test('pending close observes native settlement without assimilating its species result', async () => {
  const resource = { id: 'real' };
  const gate = deferred<typeof resource>();
  const original = gate.promise;
  let originalThenCalls = 0;
  let speciesThenCalls = 0;
  class ObserverPromise<T> extends Promise<T> {
    constructor(executor: (resolve: (value: T | PromiseLike<T>) => void,
      reject: (reason?: unknown) => void) => void) {
      super(executor);
      this.then = () => { speciesThenCalls++; throw new Error('species then'); };
    }
  }
  original.then = () => { originalThenCalls++; throw new Error('original then'); };
  Object.defineProperty(original, 'constructor', { value: { [Symbol.species]: ObserverPromise } });
  const disposed: typeof resource[] = [];
  const bag = DiBag.createBuilder().register({
    resource: DiBag.withDisposal(() => original, value => { disposed.push(value); }),
  }).build();
  expect(bag.resolve('resource')).toBe(original);
  const closing = bag.close();
  let closed = false;
  void closing.then(() => { closed = true; }, () => { closed = true; });
  await Promise.resolve();
  await Promise.resolve();
  expect(closed).toBe(false);
  expect(disposed).toEqual([]);
  expect(originalThenCalls).toBe(0);
  expect(speciesThenCalls).toBe(0);
  gate.resolve(resource);
  await closing;
  expect(disposed).toHaveLength(1);
  expect(disposed[0]).toBe(resource);
  expect(originalThenCalls).toBe(0);
  expect(speciesThenCalls).toBe(0);
});

test('direct structural thenables reject without invoking then or accepting ownership', async () => {
  const resource = { id: 'unaccepted' };
  let thenCalls = 0;
  const raw: PromiseLike<typeof resource> & { [Symbol.toStringTag]: string } = {
    [Symbol.toStringTag]: 'Promise',
    then(fulfilled) { thenCalls++; fulfilled?.(resource); throw new Error('after fulfillment'); },
  };
  let created = 0;
  const disposed: typeof resource[] = [];
  const bag = DiBag.createBuilder().register({
    resource: DiBag.withDisposal(() => { created++; return raw; },
      value => { disposed.push(value); }),
  }).build();
  expect(() => bag.resolve('resource')).toThrow(TypeError);
  expect(() => bag.resolve('resource')).toThrow(TypeError);
  await bag.close();
  expect(created).toBe(2);
  expect(thenCalls).toBe(0);
  expect(disposed).toEqual([]);
});

test('explicit structural conversion accepts fulfillment before a subsequent throw', async () => {
  const resource = { id: 'real' };
  const original: PromiseLike<typeof resource> = {
    then(fulfilled) {
      fulfilled?.(resource);
      throw new Error('after fulfillment');
    },
  };
  const disposed: typeof resource[] = [];
  let converted: Promise<typeof resource> | undefined;
  const bag = DiBag.createBuilder().register({
    resource: DiBag.withDisposal(() => {
      converted = Promise.resolve(original);
      return converted;
    }, value => { disposed.push(value); }),
  }).build();
  const exposed = bag.resolve('resource');
  expect(converted).toBe(exposed);
  expect(bag.resolve('resource')).toBe(exposed);
  await bag.close();
  expect(disposed).toHaveLength(1);
  expect(disposed[0]).toBe(resource);
});

test('explicit structural conversion retries rejection and disposes only the fulfilled retry', async () => {
  const failure = new Error('rejected thenable');
  const first = Promise.reject<number>(failure);
  const rejected: PromiseLike<number> = { then: first.then.bind(first) };
  const accepted = Promise.resolve(42);
  let created = 0;
  let converted: Promise<number> | undefined;
  const disposed: number[] = [];
  const bag = DiBag.createBuilder().register({
      resource: DiBag.withDisposal(
        () => {
          converted = Promise.resolve(++created === 1 ? rejected : accepted);
          return converted;
        },
        (value) => {
          disposed.push(value);
        },
      ),
    }).build();
  const exposed = bag.resolve('resource');
  expect(converted).toBe(exposed);
  await expect(exposed).rejects.toBe(failure);
  expect(bag.resolve('resource')).toBe(accepted);
  await bag.close();
  expect(created).toBe(2);
  expect(disposed).toEqual([42]);
});

test('cleanup runs in reverse acquisition order through unmanaged intermediates', async () => {
  const disposed: string[] = [];
  const bag = DiBag.createBuilder().register({
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
    }).build();
  bag.resolve('server');
  bag.resolve('independent');
  await bag.close();
  expect(disposed).toEqual(['independent', 'db-server', 'db']);
});

test('async disposers are awaited sequentially and receive fulfilled values', async () => {
  const gate = deferred<void>();
  const disposed: string[] = [];
  const bag = DiBag.createBuilder().register({
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
    }).build();
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
  const bag = DiBag.createBuilder().register({
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
    }).build();
  const server = bag.resolve('server');
  gate.resolve('db');
  await server.db;
  await bag.close();
  expect(disposed).toEqual(['server', 'db']);
});

test('close drains pending factories and dependencies discovered after await', async () => {
  const gate = deferred<void>();
  const disposed: string[] = [];
  const bag = DiBag.createBuilder().register({
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
    }).build();
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
  const bag = DiBag.createBuilder().register({
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
    }).build();
  bag.resolve('good');
  const bad = bag.resolve('bad');
  const closing = bag.close();
  gate.reject(new Error('acquire'));
  await expect(bad).rejects.toThrow('acquire');
  await closing;
  expect(disposed).toEqual(['good']);
});

test('every disposer runs and close aggregates the original cleanup failures', async () => {
  const disposed: string[] = [];
  const firstError = new Error('first cleanup failure');
  const laterError = new Error('later');
  const bag = DiBag.createBuilder().register({
      a: DiBag.withDisposal(
        () => 'a',
        (value) => {
          disposed.push(value);
          throw laterError;
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
    }).build();
  bag.resolve('a');
  bag.resolve('b');
  bag.resolve('c');
  const closing = bag.close();
  const failure: unknown = await closing.catch(error => error);
  expect(failure).toBeInstanceOf(DiBagCleanupError);
  if (!(failure instanceof DiBagCleanupError)) throw new Error('missing aggregate');
  expect(failure.errors).toEqual([firstError, laterError]);
  expect(failure.errors[0]).toBe(firstError);
  expect(failure.errors[1]).toBe(laterError);
  expect(bag.close()).toBe(closing);
  expect(disposed).toEqual(['c', 'b', 'a']);
  expect(() => bag.resolve('a')).toThrow(/clos/);
});

test('throwing undefined still rejects close and does not skip other disposers', async () => {
  let cleaned = false;
  const bag = DiBag.createBuilder().register({
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
    }).build();
  bag.resolve('a');
  bag.resolve('b');
  let rejected = false;
  try {
    await bag.close();
  } catch (error) {
    rejected = true;
    expect(error).toBeInstanceOf(DiBagCleanupError);
    if (!(error instanceof DiBagCleanupError)) throw new Error('missing aggregate');
    expect(error.errors).toEqual([undefined]);
  }
  expect(rejected).toBe(true);
  expect(cleaned).toBe(true);
});

test('reentrant close observes the same barrier even when its disposer rejects', async () => {
  const failure = new Error('cleanup');
  const events: string[] = [];
  let reentrant: Promise<void> | undefined;
  const bag = DiBag.createBuilder().register({
    resource: DiBag.withDisposal(() => 42, () => {
      events.push('resource');
      reentrant = bag.close();
      throw failure;
    }),
  }).build();
  bag.resolve('resource');
  const closing = bag.close();
  const error: unknown = await closing.catch(error => error);
  expect(reentrant).toBe(closing);
  expect(bag.close()).toBe(closing);
  expect(error).toBeInstanceOf(DiBagCleanupError);
  if (!(error instanceof DiBagCleanupError)) throw new Error('missing aggregate');
  expect(error.errors).toEqual([failure]);
  await expect(bag.close()).rejects.toBe(error);
  expect(events).toEqual(['resource']);
});

test('parent and forks own independent instances and borrowed overrides stay borrowed', async () => {
  let id = 0;
  const disposed: number[] = [];
  const bag = DiBag.createBuilder().register({
      value: DiBag.withDisposal(
        () => ({ id: ++id }),
        (value) => {
          disposed.push(value.id);
        },
      ),
    }).build();
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
  const bag = DiBag.createBuilder().register({ value: () => 1 }).build();
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
  const bag = DiBag.createBuilder().register({
      base: () => 21,
      middle: ({ base }: { base: number }) => base * 2,
      result: async (deps: { middle: number }) => {
        await gate.promise;
        return deps.middle;
      },
    }).build();
  const result = bag.resolve('result');
  const closing = bag.close();
  gate.resolve();
  expect(await result).toBe(42);
  await closing;
});
