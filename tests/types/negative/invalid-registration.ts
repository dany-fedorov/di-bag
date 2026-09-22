import { DiBag } from '../../../src';
// diagnostic: not assignable to type 'Registration'
DiBag.createBuilder().withServices({ value: 42 });
