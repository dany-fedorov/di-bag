import { DiBag } from '../../../src';

const builder = DiBag.begin().add({
  value: () => 1,
  consumer: ({ value }: { value: number }) => value + 1,
});
type View = ReturnType<typeof builder.replace>;
// diagnostic: is not assignable to type
const view: View = builder;

const empty = DiBag.begin();
const erasedAdd = empty.add<{ value: () => number; consumer: () => number }>;
// diagnostic: is not assignable to type
const erased: ReturnType<typeof erasedAdd> = builder;

const moduleBuilder = DiBag.module().add({
  value: () => 1,
  consumer: ({ value }: { value: number }) => value + 1,
});
const moduleView: ReturnType<typeof moduleBuilder.replace> = moduleBuilder;
const value = DiBag.begin().install(moduleView.exports(['consumer'])).end().resolve('consumer');
// diagnostic: Type 'number' is not assignable to type 'string'.
const wrong: string = value;
