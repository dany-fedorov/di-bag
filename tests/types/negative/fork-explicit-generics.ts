import { DiBag } from '../../../src';
const root = DiBag.createBuilder().register({ a: () => 1, b: () => 2 }).build();

// diagnostic: Property 'a' is missing
root.fork<readonly ['a'], {}>(['a'], { a: () => 'wrong' });

// diagnostic: Property 'b' is missing
root.fork<readonly ['a', 'b'], { a: () => number }>(
  ['a', 'b'],
  { a: () => 3, b: () => 'wrong' },
);

// diagnostic: Type '{ a: unknown; }' does not satisfy the constraint 'OverrideFactoryContext
root.fork<readonly ['a'], { a: unknown }>(['a'], { a: () => 'wrong' });

// diagnostic: Type '{ a: {}; }' does not satisfy the constraint 'OverrideFactoryContext
root.fork<readonly ['a'], { a: {} }>(['a'], { a: () => 'wrong' });
