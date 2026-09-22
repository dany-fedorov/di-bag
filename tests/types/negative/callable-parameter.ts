import { DiBag } from '../../../src/di-bag';
// diagnostic: factory dependencies
DiBag.createBuilder().withServices({ service: (deps: () => number) => deps() }).buildContainer();
