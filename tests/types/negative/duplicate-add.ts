import { DiBag } from '../../../src';
// diagnostic: withServices and withTokenService introduce new names or typed tokens only
DiBag.createBuilder().withServices({ a: () => 1 }).withServices({ a: () => 2 });
