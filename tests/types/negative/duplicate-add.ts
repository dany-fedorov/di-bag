import { DiBag } from '../../../src';
// diagnostic: add introduces new tokens only
DiBag.begin().add({ a: () => 1 }).add({ a: () => 2 });
