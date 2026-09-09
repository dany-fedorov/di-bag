import { DiBag } from '../../../src/di-bag';
// diagnostic: finite
DiBag.begin().add({
  service: (deps: { [key: `db:${string}`]: number }) => deps['db:missing'],
});
