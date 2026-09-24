import { DiBag } from 'di-bag';
import type { CatalogData } from './contract.js';
import { catalogModule } from './module.js';

DiBag.createBuilder()
  .withInstalledModules([catalogModule])
  .withServices({ catalogData: DiBag.providerWithLifetime({ provider: (): CatalogData => ({ products: [] }), lifetime: 'singleton:one-per-container-tree' }) })
  .verifyGraphAtCompileTime() satisfies void;
