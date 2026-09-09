import { DiBag } from '../../../src';

const needed = DiBag.module().add({
  hidden: ({ value }: { value: number }) => value,
}).exports([]);
const wrong = DiBag.module().add({ value: () => 'wrong' }).exports(['value']);
// diagnostic: a dependency has the wrong shape
DiBag.begin().install(needed).install(wrong);
// diagnostic: a dependency has the wrong shape
DiBag.begin().install(wrong).install(needed);
// diagnostic: missing factories
DiBag.begin().install(needed).end();

const key = Symbol('value');
const narrow = DiBag.token(key).of<number>();
const wide = DiBag.token(key).of<number | string>();
const needsWide = DiBag.module().add({
  hidden: DiBag.fromTokens([wide], value => value),
}).exports([]);
// diagnostic: a dependency has the wrong shape
DiBag.begin().bind(narrow, () => 1).install(needsWide);
const optionallyNeedsWide = DiBag.module().add({
  hidden: DiBag.fromTokens([DiBag.optional(wide)], value => value ?? 0),
}).exports([]);
// diagnostic: a dependency has the wrong shape
DiBag.begin().bind(narrow, () => 1).install(optionallyNeedsWide);
