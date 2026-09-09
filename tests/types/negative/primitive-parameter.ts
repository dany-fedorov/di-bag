import { DiBag } from '../../../src/di-bag';
// diagnostic: factory dependencies
DiBag.begin().add({ service: (value: number) => value });
