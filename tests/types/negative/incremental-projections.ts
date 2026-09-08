import { DiBag } from '../../../src';

// diagnostic: a dependency has the wrong shape
DiBag.begin()
  .add({ read: ({ value }: { value: number }) => value })
  .add({ value: () => 'wrong' });

// diagnostic: a dependency has the wrong shape
DiBag.begin()
  .add({ value: () => 'wrong' })
  .add({ read: ({ value }: { value: number }) => value });

const graph = DiBag.begin().add({
  value: () => 1,
  a: ({ value }: { value: number }) => value,
  b: ({ value }: { value: number }) => value,
});

// diagnostic: a dependency has the wrong shape
graph.add({ later: ({ value }: { value: string }) => value });
