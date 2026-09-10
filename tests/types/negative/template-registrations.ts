import { DiBag } from '../../../src/di-bag';
// diagnostic: finite
const factories: { [key: `db:${string}`]: () => number } = {};
DiBag.createBuilder().register(factories).build();
