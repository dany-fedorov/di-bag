import { DiBag } from '../../../src';
const module = DiBag.module().add({ a: () => 1, b: () => 2 });
// diagnostic: existing tokens only
module.exports(['missing']);
const widened = ['a'];
// diagnostic: finite tuple
module.exports(widened);
declare const union: 'a' | 'b';
// diagnostic: finite tuple
module.exports([union]);
declare const optional: readonly ['a'?];
// diagnostic: finite tuple
module.exports(optional);
declare const variadic: readonly ['a', ...'b'[]];
// diagnostic: finite tuple
module.exports(variadic);
declare const template: `prefix:${string}`;
// diagnostic: finite tuple
module.exports([template]);
// diagnostic: finite tuple
module.exports([Symbol('a')]);
// diagnostic: add introduces new tokens only
DiBag.begin().install(module.exports(['a'])).install(module.exports(['a']));
