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
  const fork = bag.fork({ value: () => 7 });
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
