import { DiBag } from '../../../src/di-bag';
// diagnostic: finite
const factories: Record<string, () => number> = {};
DiBag.begin()
  .add(factories)
  .add({
    service: ({ missing }: { missing: number }) => missing,
  })
  .end();
