# Task: catalog module

Implement `catalogModule` in `src/features/catalog/module.ts` with DI Bag
(`di-bag`, installed).

## Contract

`contract.ts` is fixed. The module exports exactly one service, `catalog`
(`Catalog`), and requires exactly one registration from the host,
`catalogData` (`CatalogData`, singleton per container tree).

## Behavior

- `find(sku)` returns the product with that SKU, or `undefined`.
- `list()` returns every product in the order of `catalogData.products`.
- The catalog is created once for the application: every request scope
  resolves the same `catalog` instance.
- Providers are scoped per container by default; mark the shared catalog
  singleton per container tree explicitly.

## Constraints

- Change files only inside `src/features/catalog/`. Other modules are being
  implemented at the same time by others; this checkout has only their
  `contract.ts` files. `src/app.ts` and every `contract.ts` are fixed.
- Follow the project's conventions for a module directory, and add tests for
  the module.
- Check your work with `MODULE=catalog npm run check:fast`. `npm run typecheck`
  cannot pass until every module exists.
