import { DiBag } from '../../../src/di-bag';
// diagnostic: factory dependencies
declare const key: unique symbol;
DiBag.createBuilder().withServices({ service: (deps: { [key]: number }) => deps[key] });
