import { DiBag } from '../../../src';
const module = DiBag.createBuilder().withServices({ a: () => 1, b: () => 2 });
// diagnostic: existing names or typed tokens only
module.buildModule({ exportedServiceKeys: ['missing'] });
const widened = ['a'];
// diagnostic: finite tuple
module.buildModule({ exportedServiceKeys: widened });
declare const union: 'a' | 'b';
// diagnostic: finite tuple
module.buildModule({ exportedServiceKeys: [union] });
declare const optional: readonly ['a'?];
// diagnostic: finite tuple
module.buildModule({ exportedServiceKeys: optional });
declare const variadic: readonly ['a', ...'b'[]];
// diagnostic: finite tuple
module.buildModule({ exportedServiceKeys: variadic });
declare const template: `prefix:${string}`;
// diagnostic: finite tuple
module.buildModule({ exportedServiceKeys: [template] });
// diagnostic: finite tuple
module.buildModule({ exportedServiceKeys: [Symbol('a')] });
// diagnostic: register introduces new names or typed tokens only
DiBag.createBuilder().withInstalledModules([module.buildModule({ exportedServiceKeys: ['a'] })]).withInstalledModules([module.buildModule({ exportedServiceKeys: ['a'] })]);
