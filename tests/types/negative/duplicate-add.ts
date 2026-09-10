import { DiBag } from '../../../src';
// diagnostic: register introduces new names or typed tokens only
DiBag.createBuilder().register({ a: () => 1 }).register({ a: () => 2 });
