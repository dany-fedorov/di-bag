# Task: inventory module

Implement `inventoryModule` in `src/features/inventory/module.ts` with DI Bag
(`di-bag`, installed).

## Contract

`contract.ts` is fixed. The module exports exactly one service, `inventory`
(`Inventory`), and requires exactly two registrations from the host:
`stockLevels` (`StockLevels`, singleton per container tree) and `catalog`
(`Catalog`, singleton per container tree, exported by the catalog module).

## Behavior

- Stock is one ledger for the whole application, starting from `stockLevels`.
  A SKU missing from `stockLevels` has no stock.
- `inventory` belongs to one request scope; each scope resolves its own.
- Providers are scoped per container by default; mark request holds and
  inventory explicitly scoped while keeping the ledger singleton per tree.
- `reserve(sku, quantity)` returns `false` and reserves nothing when the SKU is
  not in the catalog or fewer than `quantity` units are available. Otherwise
  it holds the units for this scope and returns `true`.
- `available(sku)` counts units neither sold nor reserved by any scope.
- `commit()` turns the scope's reservations into sales.
- When a scope closes, its uncommitted reservations are released.

## Constraints

- Change files only inside `src/features/inventory/`. Other modules are being
  implemented at the same time by others; this checkout has only their
  `contract.ts` files. `src/app.ts` and every `contract.ts` are fixed.
- Follow the project's conventions for a module directory, and add tests for
  the module.
- Check your work with `MODULE=inventory npm run check:fast`.
  `npm run typecheck` cannot pass until every module exists.
