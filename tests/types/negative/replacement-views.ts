import { DiBag } from '../../../src';

const builder = DiBag.begin().add({
  value: () => 1,
  consumer: ({ value }: { value: number }) => value + 1,
});
const moduleBuilder = DiBag.module().add({
  value: () => 1,
  consumer: ({ value }: { value: number }) => value + 1,
});
type BuilderView = ReturnType<typeof builder.replace>;
type ModuleView = ReturnType<typeof moduleBuilder.replace>;

// diagnostic: is not assignable to type
const builderView: BuilderView = builder;
const moduleView: ModuleView = moduleBuilder;
const feature = moduleView.exports(['value', 'consumer']);
const consumer = DiBag.begin().install(feature).end().resolve('consumer');
// diagnostic: Type 'number' is not assignable to type 'string'.
const wrong: string = consumer;
