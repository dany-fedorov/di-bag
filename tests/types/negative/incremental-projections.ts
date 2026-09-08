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

const key = Symbol('projection-boundary');
const token = DiBag.token(key).of<number>();
const wider = DiBag.token(key).of<number | string>();

// diagnostic: token dependency has an incompatible or opaque contract
DiBag.begin()
  .add({ unrelated: () => true })
  .bind(token, () => 1)
  .add({ read: DiBag.fromTokens([wider], value => value) });

// diagnostic: token dependency has an incompatible or opaque contract
DiBag.begin()
  .add({ read: DiBag.fromTokens([wider], value => value) })
  .add({ unrelated: () => true })
  .bind(token, () => 1);
