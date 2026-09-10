import { DiBag } from '../../../src';
const module = DiBag.createBuilder().register({ privateValue: () => 1, value: () => 2 }).buildModule(['value']);
// diagnostic: Argument of type '"privateValue"'
DiBag.createBuilder().installModule(module).build().resolve('privateValue');
