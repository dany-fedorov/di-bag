import { DiBag } from '../../../src/di-bag';
// diagnostic: missing
DiBag.createBuilder().withServices({ service: (deps?: { clock: number }) => deps?.clock }).buildContainer();
