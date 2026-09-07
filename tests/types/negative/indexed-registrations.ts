import { DiBag } from '../../../src/di-bag';
// diagnostic: finite
// diagnostic-also: TS2345 add introduces new tokens only
const factories: Record<string, () => number> = {};
DiBag.begin()
  .add(factories)
  .add({
    service: ({ missing }: { missing: number }) => missing,
  })
  .end();
