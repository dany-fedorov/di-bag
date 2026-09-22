import { DiBag } from '../../../src';
const module = DiBag.createBuilder().withServices({ value: ({ external }: { external: number }) => external }).buildModule({ exportedServiceKeys: ['value'] });
// diagnostic: provided service does not satisfy its consumer dependency
DiBag.createBuilder().withInstalledModules([module]).withServices({ external: () => 'wrong' });
// diagnostic: provided service does not satisfy its consumer dependency
DiBag.createBuilder().withServices({ external: () => 'wrong' }).withInstalledModules([module]);
const other = DiBag.createBuilder().withServices({ value2: ({ external }: { external: string }) => external }).buildModule({ exportedServiceKeys: ['value2'] });
// diagnostic: provided service does not satisfy its consumer dependency
DiBag.createBuilder().withInstalledModules([module]).withInstalledModules([other]).withServices({ external: () => 1 });
