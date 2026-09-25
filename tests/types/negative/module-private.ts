import { DiBag } from '../../../src';
const module = DiBag.createBuilder().withServices({ privateValue: () => 1, value: () => 2 }).buildModule({ exportedServiceKeys: ['value'] });
// diagnostic: Argument of type '"privateValue"'
DiBag.createBuilder().withInstalledModules([module]).buildContainer().resolve('privateValue');
