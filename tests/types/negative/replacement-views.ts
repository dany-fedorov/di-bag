import { DiBag } from '../../../src';

const builder = DiBag.createBuilder().register({
  value: () => 1,
  consumer: ({ value }: { value: number }) => value + 1,
});
const moduleBuilder = DiBag.createModuleBuilder().register({
  value: () => 1,
  consumer: ({ value }: { value: number }) => value + 1,
});
type BuilderView = ReturnType<typeof builder.replace>;
type ModuleView = ReturnType<typeof moduleBuilder.replace>;

// diagnostic: is not assignable to type
const builderView: BuilderView = builder;
const moduleView: ModuleView = moduleBuilder;
const feature = moduleView.buildModule(['value', 'consumer']);
const consumer = DiBag.createBuilder().installModule(feature).build().resolve('consumer');
// diagnostic: Type 'number' is not assignable to type 'string'.
const wrong: string = consumer;
