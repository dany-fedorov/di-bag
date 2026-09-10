import { DiBag } from '../../../src/di-bag';
// diagnostic: factory dependencies
declare const key: unique symbol;
DiBag.createBuilder().register({ service: (deps: { [key]: number }) => deps[key] });
