import { DiBag } from '../../../src';

const needed = DiBag.createModuleBuilder().register({
  hidden: ({ value }: { value: number }) => value,
}).buildModule([]);
const wrong = DiBag.createModuleBuilder().register({ value: () => 'wrong' }).buildModule(['value']);
// diagnostic: provided service does not satisfy its consumer dependency
DiBag.createBuilder().installModule(needed).installModule(wrong);
// diagnostic: provided service does not satisfy its consumer dependency
DiBag.createBuilder().installModule(wrong).installModule(needed);
// diagnostic: required service registrations are missing
DiBag.createBuilder().installModule(needed).build();

const key = Symbol('value');
const narrow = DiBag.token(key).of<number>();
const wide = DiBag.token(key).of<number | string>();
const needsWide = DiBag.createModuleBuilder().register({
  hidden: DiBag.fromFunction([wide], value => value),
}).buildModule([]);
// diagnostic: provided service does not satisfy its consumer dependency
DiBag.createBuilder().register(narrow, () => 1).installModule(needsWide);
const optionallyNeedsWide = DiBag.createModuleBuilder().register({
  hidden: DiBag.fromFunction([DiBag.optional(wide)], value => value ?? 0),
}).buildModule([]);
// diagnostic: provided service does not satisfy its consumer dependency
DiBag.createBuilder().register(narrow, () => 1).installModule(optionallyNeedsWide);
