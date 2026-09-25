import { DiBag } from '../../../src';
const module = DiBag.createBuilder().withServices({ value: ({ external }: { external: number }) => external }).buildModule({ exportedServiceKeys: ['value'] });
// diagnostic: required services are missing
DiBag.createBuilder().withInstalledModules([module]).buildContainer();
