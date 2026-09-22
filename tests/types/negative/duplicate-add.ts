import { DiBag } from '../../../src';
// diagnostic: register introduces new names or typed tokens only
DiBag.createBuilder().withServices({ a: () => 1 }).withServices({ a: () => 2 });
