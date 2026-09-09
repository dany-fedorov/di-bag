import { DiBag } from '../../../src';
// diagnostic: not assignable
// Boolean's inherited valueOf method is not an own factory registration.
DiBag.begin().add(true).end().resolve('valueOf');
