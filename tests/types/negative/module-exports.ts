import { DiBag } from '../../../src';
const module = DiBag.createModuleBuilder().register({ a: () => 1, b: () => 2 });
// diagnostic: existing names or typed tokens only
module.buildModule(['missing']);
const widened = ['a'];
// diagnostic: finite tuple
module.buildModule(widened);
declare const union: 'a' | 'b';
// diagnostic: finite tuple
module.buildModule([union]);
declare const optional: readonly ['a'?];
// diagnostic: finite tuple
module.buildModule(optional);
declare const variadic: readonly ['a', ...'b'[]];
// diagnostic: finite tuple
module.buildModule(variadic);
declare const template: `prefix:${string}`;
// diagnostic: finite tuple
module.buildModule([template]);
// diagnostic: finite tuple
module.buildModule([Symbol('a')]);
// diagnostic: register introduces new names or typed tokens only
DiBag.createBuilder().installModule(module.buildModule(['a'])).installModule(module.buildModule(['a']));
