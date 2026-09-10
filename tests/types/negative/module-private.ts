import { DiBag } from '../../../src';
const module = DiBag.createModuleBuilder().register({ privateValue: () => 1, value: () => 2 }).buildModule(['value']);
// diagnostic: Argument of type '"privateValue"'
DiBag.createBuilder().installModule(module).build().resolve('privateValue');
