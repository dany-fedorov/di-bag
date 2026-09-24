// catalogModule exports `catalog`; the host registers `catalogData`.

export type Product = { sku: string; name: string; priceCents: number };

/** Product lookup shared by the whole application. */
export type Catalog = {
  /** The product with this SKU, or undefined. */
  find(sku: string): Product | undefined;
  /** Every product, in the order of `CatalogData.products`. */
  list(): readonly Product[];
};

/** Registered by the host as singleton per container tree. */
export type CatalogData = { products: readonly Product[] };

export type CatalogExports = { catalog: Catalog };
export type CatalogRequirements = { catalogData: CatalogData };
