import { DiBag } from '../../../src/di-bag';
// diagnostic: missing
DiBag.begin()
  .add({ service: (deps?: { clock: number }) => deps?.clock })
  .end();
