import { DiBag } from '../../../src/di-bag';
// diagnostic: missing
DiBag.createBuilder().register({ service: (deps?: { clock: number }) => deps?.clock }).build();
