import { DiBag } from '../../../src/di-bag';
// diagnostic: factory dependencies
DiBag.createBuilder().register({ service: (value: number) => value });
