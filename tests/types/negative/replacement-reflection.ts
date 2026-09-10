import { DiBag } from '../../../src';

const builder = DiBag.createBuilder().register({
  value: () => 1,
  consumer: ({ value }: { value: number }) => value + 1,
});
type View = ReturnType<typeof builder.replace>;
// diagnostic: is not assignable to type
const view: View = builder;

const empty = DiBag.createBuilder();
const erasedAdd = empty.register<{ value: () => number; consumer: () => number }>;
// diagnostic: is not assignable to type
const erased: ReturnType<typeof erasedAdd> = builder;

const moduleBuilder = DiBag.createModuleBuilder().register({
  value: () => 1,
  consumer: ({ value }: { value: number }) => value + 1,
});
const moduleView: ReturnType<typeof moduleBuilder.replace> = moduleBuilder;
const value = DiBag.createBuilder().installModule(moduleView.buildModule(['consumer'])).build().resolve('consumer');
// diagnostic: Type 'number' is not assignable to type 'string'.
const wrong: string = value;
