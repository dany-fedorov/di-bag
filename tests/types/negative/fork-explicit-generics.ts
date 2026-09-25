import { DiBag } from '../../../src';
const root = DiBag.createBuilder().withServices({ a: () => 1, b: () => 2 }).buildContainer();

// diagnostic: Property 'a' is missing
root.createIndependentContainer<readonly ['a'], {}>(['a'], { a: () => 'wrong' });

// diagnostic: Property 'b' is missing
root.createIndependentContainer<readonly ['a', 'b'], { a: () => number }>(
  ['a', 'b'],
  { a: () => 3, b: () => 'wrong' },
);

// diagnostic: Type '{ a: unknown; }' does not satisfy the constraint 'OverrideFactoryContext
root.createIndependentContainer<readonly ['a'], { a: unknown }>(['a'], { a: () => 'wrong' });

// diagnostic: Type '{ a: {}; }' does not satisfy the constraint 'OverrideFactoryContext
root.createIndependentContainer<readonly ['a'], { a: {} }>(['a'], { a: () => 'wrong' });
