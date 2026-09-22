import { DiBag } from 'di-bag';
import type { CatalogData } from './contract.js';
import { catalogModule } from './module.js';

DiBag.createBuilder()
  .withInstalledModules([catalogModule])
  .withServices({ catalogData: DiBag.withLifetime((): CatalogData => ({ products: [] }), 'root') })
  .verifyGraphAtCompileTime() satisfies void;
