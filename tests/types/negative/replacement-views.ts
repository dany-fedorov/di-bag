import { DiBag } from '../../../src';

const builder = DiBag.createBuilder().withServices({
  value: () => 1,
  consumer: ({ value }: { value: number }) => value + 1,
});
const moduleBuilder = DiBag.createBuilder().withServices({
  value: () => 1,
  consumer: ({ value }: { value: number }) => value + 1,
});
type BuilderView = ReturnType<typeof builder.withReplacedService>;
type ModuleView = ReturnType<typeof moduleBuilder.withReplacedService>;

// diagnostic: is not assignable to type
const builderView: BuilderView = builder;
// diagnostic: is not assignable to type
const moduleView: ModuleView = moduleBuilder;
const feature = moduleBuilder.buildModule({ exportedServiceKeys: ['value', 'consumer'] });
const consumer = DiBag.createBuilder().withInstalledModules([feature]).buildContainer().resolve('consumer');
// diagnostic: Type 'number' is not assignable to type 'string'.
const wrong: string = consumer;
