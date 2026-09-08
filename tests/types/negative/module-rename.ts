import { DiBag } from '../../../src';
const module = DiBag.module().add({ a: () => 1, b: () => 2 }).exports(['a', 'b']);
// diagnostic: rename requires
module.rename('missing', 'c');
// diagnostic: rename requires
module.rename('a', 'b');
declare const widened: string;
// diagnostic: rename requires
module.rename('a', widened);
declare const union: 'a' | 'b';
// diagnostic: rename requires
module.rename(union, 'c');
declare const template: `prefix:${string}`;
// diagnostic: rename requires
module.rename('a', template);
const constrained = DiBag.module().add({
  value: () => ({ read() { return 1; }, extra() { return true; } }),
  hidden: ({ value }: { value: { extra(): boolean } }) => value.extra(),
}).exports(['value']).rename('value', 'renamed');
// diagnostic: a dependency has the wrong shape
DiBag.begin().install(constrained).replace('renamed', () => ({ read() { return 2; } }));
const collision = DiBag.module().add({
  value: () => 1,
  hidden: ({ value, external }: { value: number; external: string }) => [value, external],
}).exports(['value']).rename('value', 'external');
// diagnostic: a dependency has the wrong shape
DiBag.begin().install(collision);
