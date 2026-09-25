import { DiBag } from '../../../src';
// diagnostic: not assignable to type 'ProviderOrFactory'
DiBag.createBuilder().withServices({ value: 42 });
