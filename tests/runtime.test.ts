import { expect, test } from 'bun:test';
import { DiBag } from '../src/di-bag';

test('sync diamond dependencies are created once and stay synchronous', () => {
  let creations = 0;
  const bag = DiBag.begin()
    .add({
      base: () => {
        creations++;
        return { value: 3 };
      },
      left: ({ base }: { base: { value: number } }) => base,
      right: ({ base }: { base: { value: number } }) => base,
      top: ({
        left,
        right,
      }: {
        left: { value: number };
        right: { value: number };
      }) => ({ left, right }),
    })
    .end();
  const top = bag.resolve('top');
  expect(top.left).toBe(top.right);
  expect(top.left.value).toBe(3);
  expect(creations).toBe(1);
});

test('undefined is memoized', () => {
  let creations = 0;
  const bag = DiBag.begin()
    .add({
      empty: () => {
        creations++;
      },
    })
    .end();
  expect(bag.resolve('empty')).toBeUndefined();
  expect(bag.resolve('empty')).toBeUndefined();
  expect(creations).toBe(1);
});

test('forward registration and forks use independent memoization', () => {
  const bag = DiBag.begin()
    .add({ doubled: ({ value }: { value: number }) => ({ value: value * 2 }) })
    .add({ value: () => 3 })
    .end();
  const fork = bag.fork(['value'], { value: () => 7 });
  expect(bag.resolve('doubled').value).toBe(6);
  expect(fork.resolve('doubled').value).toBe(14);
  expect(bag.resolve('doubled')).not.toBe(fork.resolve('doubled'));
});

test('synchronous factory failure can be retried', () => {
  let attempts = 0;
  const bag = DiBag.begin()
    .add({
      value: () => {
        if (++attempts === 1) throw new Error('unavailable');
        return 42;
      },
    })
    .end();
  expect(() => bag.resolve('value')).toThrow('unavailable');
  expect(bag.resolve('value')).toBe(42);
});

test('ending one builder twice and forking create fresh owned roots', async () => {
  const disposed: number[] = [];
  let created = 0;
  const builder = DiBag.begin().add({
    resource: DiBag.withDisposal(
      () => ({ id: ++created }),
      value => { disposed.push(value.id); },
    ),
  });
  const first = builder.end();
  const second = builder.end();
  const fork = first.fork();
  expect(first.resolve('resource')).toEqual({ id: 1 });
  expect(second.resolve('resource')).toEqual({ id: 2 });
  expect(fork.resolve('resource')).toEqual({ id: 3 });
  await first.close();
  expect(disposed).toEqual([1]);
  expect(second.resolve('resource')).toEqual({ id: 2 });
  expect(fork.resolve('resource')).toEqual({ id: 3 });
  await second.close();
  await fork.close();
  expect(disposed).toEqual([1, 2, 3]);
});

test('async dependencies remain explicit and concurrent resolutions share a promise', async () => {
  let creations = 0;
  const bag = DiBag.begin()
    .add({
      base: async () => {
        creations++;
        return 21;
      },
      answer: async ({ base }: { base: Promise<number> }) => (await base) * 2,
      sync: () => 7,
    })
    .end();
  const first = bag.resolve('answer');
  expect(first).toBe(bag.resolve('answer'));
  expect(await first).toBe(42);
  expect(bag.resolve('sync')).toBe(7);
  expect(creations).toBe(1);
});

test('synchronous cycles include their dependency path', () => {
  const bag = DiBag.begin()
    .add({
      a: ({ b }: { b: number }) => b,
      b: ({ a }: { a: number }) => a,
    })
    .end();
  expect(() => bag.resolve('a')).toThrow(/cycle: .*a.*b.*a/);
});

test('prototype properties are not factories', () => {
  const bag = DiBag.begin()
    .add({ value: () => 1 })
    .end();
  expect(() => bag.resolve('toString' as 'value')).toThrow('no factory');
});

test('async factory rejections can be retried', async () => {
  let attempts = 0;
  const bag = DiBag.begin()
    .add({
      value: async () => {
        if (++attempts === 1) throw new Error('unavailable');
        return 42;
      },
    })
    .end();
  await expect(bag.resolve('value')).rejects.toThrow('unavailable');
  expect(await bag.resolve('value')).toBe(42);
});

test('synchronous failure discards abandoned edges before retrying another token', () => {
  let fail = true;
  const bag = DiBag.begin()
    .add({
      a: (deps: { b: number }): number => (fail ? deps.b : 1),
      b: (deps: { a: number }): number => {
        if (fail) {
          fail = false;
          throw new Error('temporary');
        }
        return deps.a;
      },
    })
    .end();
  expect(() => bag.resolve('a')).toThrow('temporary');
  expect(bag.resolve('b')).toBe(1);
});

test('async failure discards abandoned edges before retrying another token', async () => {
  let fail = true;
  const bag = DiBag.begin()
    .add({
      a: async (deps: { b: Promise<number> }): Promise<number> =>
        fail ? await deps.b : 1,
      b: async (deps: { a: Promise<number> }): Promise<number> => {
        if (fail) {
          fail = false;
          throw new Error('temporary');
        }
        return await deps.a;
      },
    })
    .end();
  await expect(bag.resolve('a')).rejects.toThrow('temporary');
  expect(await bag.resolve('b')).toBe(1);
});

test('then inspection failure discards outgoing edges before another token retries', async () => {
  const failure = new Error('then getter');
  let fail = true;
  const bag = DiBag.begin()
    .add({
      a: (deps: { b: { value: number } }): { value: number } => {
        if (!fail) return { value: 42 };
        try {
          deps.b;
        } catch {
          // The failed dependency leaves a recorded outgoing edge on a.
        }
        const unobservable = {
          value: 0,
          get then(): undefined {
            throw failure;
          },
        };
        return unobservable;
      },
      b: (deps: { a: { value: number } }): { value: number } => {
        if (fail) throw new Error('dependency unavailable');
        return deps.a;
      },
    })
    .end();
  expect(() => bag.resolve('a')).toThrow(failure);
  fail = false;
  expect(bag.resolve('b')).toEqual({ value: 42 });
  await bag.close();
});

test('cycles discovered after await reject instead of hanging', async () => {
  const bag = DiBag.begin()
    .add({
      a: async (deps: { b: Promise<number> }): Promise<number> => {
        await Promise.resolve();
        return await deps.b;
      },
      b: async (deps: { a: Promise<number> }): Promise<number> => {
        await Promise.resolve();
        return await deps.a;
      },
    })
    .end();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('resolution hung')), 200);
    });
    await expect(Promise.race([bag.resolve('a'), deadline])).rejects.toThrow(
      /cycle: .*a.*b.*a/,
    );
  } finally {
    clearTimeout(timer);
  }
});
