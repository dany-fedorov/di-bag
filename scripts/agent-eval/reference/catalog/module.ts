import { DiBag } from 'di-bag';
import type { Catalog, CatalogData } from './contract.js';

export const catalogModule = DiBag.createBuilder()
  .withServices({
    catalog: DiBag.providerWithLifetime({ provider: ({ catalogData }: { catalogData: CatalogData }): Catalog => {
      const bySku = new Map(catalogData.products.map(product => [product.sku, product]));
      return { find: sku => bySku.get(sku), list: () => catalogData.products };
    }, lifetime: 'singleton:one-per-container-tree' }),
  })
  .buildModule({ exportedServiceKeys: ['catalog'], moduleLabel: 'catalog' });
