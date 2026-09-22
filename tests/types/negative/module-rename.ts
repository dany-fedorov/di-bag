import { DiBag } from '../../../src';
const module = DiBag.createBuilder().withServices({ a: () => 1, b: () => 2 }).buildModule({ exportedServiceKeys: ['a', 'b'] });
// diagnostic: withRenamedExport requires
module.withRenamedExport({ currentExportKey: 'missing', newExportKey: 'c' });
// diagnostic: withRenamedExport requires
module.withRenamedExport({ currentExportKey: 'a', newExportKey: 'b' });
declare const widened: string;
// diagnostic: withRenamedExport requires
module.withRenamedExport({ currentExportKey: 'a', newExportKey: widened });
declare const union: 'a' | 'b';
// diagnostic: withRenamedExport requires
module.withRenamedExport({ currentExportKey: union, newExportKey: 'c' });
declare const template: `prefix:${string}`;
// diagnostic: withRenamedExport requires
module.withRenamedExport({ currentExportKey: 'a', newExportKey: template });
const constrained = DiBag.createBuilder().withServices({
  value: () => ({ read() { return 1; }, extra() { return true; } }),
  hidden: ({ value }: { value: { extra(): boolean } }) => value.extra(),
}).buildModule({ exportedServiceKeys: ['value'] }).withRenamedExport({ currentExportKey: 'value', newExportKey: 'renamed' });
// diagnostic: provided service does not satisfy its consumer dependency
DiBag.createBuilder().withInstalledModules([constrained]).withReplacedService('renamed', () => ({ read() { return 2; } }));
const collision = DiBag.createBuilder().withServices({
  value: () => 1,
  hidden: ({ value, external }: { value: number; external: string }) => [value, external],
}).buildModule({ exportedServiceKeys: ['value'] }).withRenamedExport({ currentExportKey: 'value', newExportKey: 'external' });
// diagnostic: provided service does not satisfy its consumer dependency
DiBag.createBuilder().withInstalledModules([collision]);
