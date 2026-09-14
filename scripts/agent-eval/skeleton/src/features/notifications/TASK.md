# Task: notifications module

Implement `notificationsModule` in `src/features/notifications/module.ts` with
DI Bag (`di-bag`, installed).

## Contract

`contract.ts` is fixed. The module exports exactly one service, `notifier`
(`Notifier`), and requires exactly one registration from the host,
`mailConfig` (`MailConfig`, root lifetime).

## Behavior

- `orderPlaced({ orderId, totalCents })` sends one mail through a
  `MailTransport` to `mailConfig.opsAddress` with subject
  `Order <orderId> placed` and body `Total: <totalCents> cents`, and resolves
  after `send` resolves.
- The application opens at most one transport, with `mailConfig.connect()`,
  and shares it across all request scopes. An application that never resolves
  `notifier` never connects.
- Closing the application closes the transport once. Closing a request scope
  does not close it.

## Constraints

- Change files only inside `src/features/notifications/`. Other modules are
  being implemented at the same time by others; this checkout has only their
  `contract.ts` files. `src/app.ts` and every `contract.ts` are fixed.
- Follow the project's conventions for a module directory, and add tests for
  the module.
- Check your work with `MODULE=notifications npm run check:fast`.
  `npm run typecheck` cannot pass until every module exists.
