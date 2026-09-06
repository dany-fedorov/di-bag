import { DiBag } from '../../../src/di-bag';
// diagnostic: factory dependencies
DiBag.begin()
  .add({ service: (deps: { a: number } | { b: string }) => deps })
  .end();
