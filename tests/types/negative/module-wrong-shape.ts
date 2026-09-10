import { DiBag } from '../../../src';
const module = DiBag.createModuleBuilder().register({ value: ({ external }: { external: number }) => external }).buildModule(['value']);
// diagnostic: provided service does not satisfy its consumer dependency
DiBag.createBuilder().installModule(module).register({ external: () => 'wrong' });
// diagnostic: provided service does not satisfy its consumer dependency
DiBag.createBuilder().register({ external: () => 'wrong' }).installModule(module);
const other = DiBag.createModuleBuilder().register({ value2: ({ external }: { external: string }) => external }).buildModule(['value2']);
// diagnostic: provided service does not satisfy its consumer dependency
DiBag.createBuilder().installModule(module).installModule(other).register({ external: () => 1 });
