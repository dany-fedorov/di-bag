import { DiBag } from '../../../src';
const module = DiBag.createBuilder().withServices({ a: () => 1, b: () => 2 }).buildModule({ exportedServiceKeys: ['a', 'b'] });
// diagnostic: renameExport requires
module.renameExport('missing', 'c');
// diagnostic: renameExport requires
module.renameExport('a', 'b');
declare const widened: string;
// diagnostic: renameExport requires
module.renameExport('a', widened);
declare const union: 'a' | 'b';
// diagnostic: renameExport requires
module.renameExport(union, 'c');
declare const template: `prefix:${string}`;
// diagnostic: renameExport requires
module.renameExport('a', template);
const constrained = DiBag.createBuilder().withServices({
  value: () => ({ read() { return 1; }, extra() { return true; } }),
  hidden: ({ value }: { value: { extra(): boolean } }) => value.extra(),
}).buildModule({ exportedServiceKeys: ['value'] }).renameExport('value', 'renamed');
// diagnostic: provided service does not satisfy its consumer dependency
DiBag.createBuilder().withInstalledModules([constrained]).withReplacedService('renamed', () => ({ read() { return 2; } }));
const collision = DiBag.createBuilder().withServices({
  value: () => 1,
  hidden: ({ value, external }: { value: number; external: string }) => [value, external],
}).buildModule({ exportedServiceKeys: ['value'] }).renameExport('value', 'external');
// diagnostic: provided service does not satisfy its consumer dependency
DiBag.createBuilder().withInstalledModules([collision]);
