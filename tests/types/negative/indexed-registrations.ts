import { DiBag } from '../../../src/di-bag';
// diagnostic: finite
// diagnostic-also: TS2345 withServices and withTokenService introduce new names or typed tokens only
const factories: Record<string, () => number> = {};
DiBag.createBuilder().withServices(factories).withServices({
    service: ({ missing }: { missing: number }) => missing,
  }).buildContainer();
