import { DiBag } from '../../../src/di-bag';
// diagnostic: finite
const factories: { [key: `db:${string}`]: () => number } = {};
DiBag.begin().add(factories).end();
