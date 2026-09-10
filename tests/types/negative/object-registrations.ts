import { DiBag } from '../../../src';
// diagnostic: not assignable
const registrations: object = { value: 42 };
DiBag.createBuilder().register(registrations);
