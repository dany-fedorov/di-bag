// The module installs with fixtures for exactly its contract's requirements and exports its contract.
import { DiBag } from 'di-bag';
import type { Catalog, CatalogData } from '../../src/features/catalog/contract.js';
import { catalogModule } from '../../src/features/catalog/module.js';

const builder = DiBag.createBuilder()
  .installModule(catalogModule)
  .register({ catalogData: DiBag.withLifetime((): CatalogData => ({ products: [] }), 'root') });

builder.verifyGraph() satisfies void;
export const exported = (): Catalog => builder.build().resolve('catalog');
