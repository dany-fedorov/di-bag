import { DiBag } from 'di-bag/node';
import type { Catalog, CatalogData } from './contract.js';

export const catalogModule = DiBag.createBuilder()
  .register({
    catalog: DiBag.withLifetime(({ catalogData }: { catalogData: CatalogData }): Catalog => {
      const bySku = new Map(catalogData.products.map(product => [product.sku, product]));
      return { find: sku => bySku.get(sku), list: () => catalogData.products };
    }, 'root'),
  })
  .buildModule(['catalog'], { label: 'catalog' });
