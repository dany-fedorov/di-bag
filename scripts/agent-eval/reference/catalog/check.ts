import { DiBag } from 'di-bag/node';
import type { CatalogData } from './contract.js';
import { catalogModule } from './module.js';

DiBag.createBuilder()
  .installModule(catalogModule)
  .register({ catalogData: DiBag.withLifetime((): CatalogData => ({ products: [] }), 'root') })
  .verifyGraph() satisfies void;
