# Task: checkout module

Implement `checkoutModule` in `src/features/checkout/module.ts` with DI Bag
(`di-bag`, installed).

## Contract

`contract.ts` is fixed. The module exports exactly one service, `checkout`
(`Checkout`), and requires exactly four registrations from the host:
`catalog` (`Catalog`, root lifetime, from the catalog module), `inventory`
(`Inventory`, per request scope, from the inventory module), `payments`
(`PaymentGateway`, per request scope), and `notifier` (`Notifier`, from the
notifications module).

## Behavior

`checkout` belongs to one request scope, which places at most one order.
`placeOrder(lines)`:

1. Rejects with an `Error` when `lines` is empty.
2. For each line, rejects with an `Error` when the SKU is not in the catalog
   or `inventory.reserve(sku, quantity)` returns `false`.
3. Charges `payments` once with the total: the sum of `priceCents * quantity`.
   If the charge rejects, `placeOrder` rejects with that error.
4. After a successful charge, calls `inventory.commit()` once, then
   `notifier.orderPlaced({ orderId, totalCents })`, and resolves to
   `{ orderId, totalCents, chargeId }`, where `chargeId` is what `charge`
   resolved to.

A rejected order never commits the inventory or notifies. Order ids are
non-empty strings, unique across the application.

## Constraints

- Change files only inside `src/features/checkout/`. Other modules are being
  implemented at the same time by others; this checkout has only their
  `contract.ts` files. `src/app.ts` and every `contract.ts` are fixed.
- Follow the project's conventions for a module directory, and add tests for
  the module.
- Check your work with `MODULE=checkout npm run check:fast`.
  `npm run typecheck` cannot pass until every module exists.
