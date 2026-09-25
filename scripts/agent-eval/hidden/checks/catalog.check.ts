// The module installs with fixtures for exactly its contract's requirements and exports its contract.
import { DiBag } from 'di-bag';
import type { Catalog, CatalogData } from '../../src/features/catalog/contract.js';
import { catalogModule } from '../../src/features/catalog/module.js';

const builder = DiBag.createBuilder()
  .withInstalledModules([catalogModule])
  .withServices({ catalogData: DiBag.providerWithLifetime({ provider: (): CatalogData => ({ products: [] }), lifetime: 'singleton:one-per-container-tree' }) });

builder.verifyGraphAtCompileTime() satisfies void;
export const exported = (): Catalog => builder.buildContainer().resolve('catalog');
