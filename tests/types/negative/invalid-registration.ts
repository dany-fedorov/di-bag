import { DiBag } from '../../../src';
// diagnostic: not assignable to type 'Registration'
DiBag.createBuilder().register({ value: 42 });
