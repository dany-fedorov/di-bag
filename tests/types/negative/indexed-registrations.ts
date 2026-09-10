import { DiBag } from '../../../src/di-bag';
// diagnostic: finite
// diagnostic-also: TS2345 register introduces new names or typed tokens only
const factories: Record<string, () => number> = {};
DiBag.createBuilder().register(factories).register({
    service: ({ missing }: { missing: number }) => missing,
  }).build();
