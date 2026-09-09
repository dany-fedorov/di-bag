import { DiBag } from '../../../src';
const module = DiBag.module().add({ privateValue: () => 1, value: () => 2 }).exports(['value']);
// diagnostic: Argument of type '"privateValue"'
DiBag.begin().install(module).end().resolve('privateValue');
