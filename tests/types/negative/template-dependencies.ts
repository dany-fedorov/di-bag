import { DiBag } from '../../../src/di-bag';
// diagnostic: finite
DiBag.createBuilder().register({
  service: (deps: { [key: `db:${string}`]: number }) => deps['db:missing'],
});
