import { DiBag } from '../../../src';

// diagnostic: provided service does not satisfy its consumer dependency
DiBag.createBuilder().register({ read: ({ value }: { value: number }) => value }).register({ value: () => 'wrong' });

// diagnostic: provided service does not satisfy its consumer dependency
DiBag.createBuilder().register({ value: () => 'wrong' }).register({ read: ({ value }: { value: number }) => value });

const graph = DiBag.createBuilder().register({
  value: () => 1,
  a: ({ value }: { value: number }) => value,
  b: ({ value }: { value: number }) => value,
});

// diagnostic: provided service does not satisfy its consumer dependency
graph.register({ later: ({ value }: { value: string }) => value });

const key = Symbol('projection-boundary');
const token = DiBag.token(key).of<number>();
const wider = DiBag.token(key).of<number | string>();

// diagnostic: token dependency has an incompatible or opaque contract
DiBag.createBuilder().register({ unrelated: () => true }).register(token, () => 1).register({ read: DiBag.fromFunction([wider], value => value) });

// diagnostic: token dependency has an incompatible or opaque contract
DiBag.createBuilder().register({ read: DiBag.fromFunction([wider], value => value) }).register({ unrelated: () => true }).register(token, () => 1);
