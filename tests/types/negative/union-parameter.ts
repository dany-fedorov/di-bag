import { DiBag } from '../../../src/di-bag';
// diagnostic: factory dependencies
DiBag.createBuilder().withServices({ service: (deps: { a: number } | { b: string }) => deps }).buildContainer();
