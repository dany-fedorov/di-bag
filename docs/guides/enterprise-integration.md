# Request scopes, test fixtures, and dynamic features

[← README](../../README.md) · [API guide](api-reference.md) · [Server recipes](server-integration.md)

DI Bag supplies the ownership and composition primitives needed at a request,
job, message or UI environment boundary. The application decides when that
boundary begins and when all its work has finished. The
[comparison guide](comparison.md) explains how these capabilities differ from
NestJS, Angular, and standalone containers.

## One owned scope per operation

The executable [`withOwnedScope` recipe](../../examples/integration/owned-scope.ts)
accepts an acquisition callback and a typed work callback. It awaits the work,
closes the acquired scope exactly once, and returns `Promise<Awaited<R>>` to
model its explicit awaiting of work, including structural thenables. If work
and cleanup both fail, its `AggregateError.errors` contains the original work
failure followed by the cleanup failure. A lone failure retains its identity,
including JavaScript's valid `throw undefined` case. The following snippet assumes
you have imported that helper and have an application `root` with `request` and
`handler` providers, plus the current operation's `requestId`.

```ts
const result = await withOwnedScope(
  () =>
    root.createScope(['request'], {
      request: () => ({ id: requestId }),
    }),
  async (scope) => {
    const handler = scope.resolve('handler');
    return await handler.run();
  },
);
```

The application root declares the `request` provider's shape; the scope's explicit
selection and override remain checked against every consumer, including private
module dependencies. Root-lifetime services retain their original dependencies
and are released by the root. Scoped and transient resources belong to the
operation that acquired them. Copy this small recipe into application code; it
is not an extra package export.

Use `DiBag.fromFactory` for cooperative work that needs the acquisition owner's
`AbortSignal`. Closing the scope aborts its signal and drains owned acquisitions.
For transport cancellation of an active service method, abort an
application-controlled signal, coordinate completion of that work, and then
close the scope. A scope tracks acquisition work and disposal, not every later
method call on a service. Calling `scope.close()` directly from a disconnect hook
is appropriate only when no such call still needs the scope's owned resources.
Observe cleanup rejection and remove hooks when the operation finishes.
Cancellation does not forcibly stop arbitrary code. See the
[server cancellation guidance](server-integration.md#disconnects-streaming-and-websockets).
For streamed responses, keep the scope open until the stream finishes or is
cancelled; returning a stream object from the work callback ends this recipe's
ownership too soon.

Never pass an existing shared application root as `acquire()` unless the operation
intentionally owns shutting down the entire application. If acquisition itself
fails, it must clean its partial acquisitions. `BagBuilder.buildAndStart()` supplies startup
rollback. A cancelled startup exposes eventual cleanup on
`DiBagStartupCancelledError.cleanupPromise`; a host needing fully drained cancellation
must await that promise explicitly.

The [integration tests](../../tests/enterprise-integration.test.ts) run overlapping
operations that synchronize before completion. They prove distinct request values
inside private modules, shared root identity, scope signal cancellation, child
cleanup before root cleanup, and retention of both handler and cleanup errors.

## Checked test substitutions

Tests use the same checked builder and scope APIs as applications. Given a
`builder` whose `result` service calls `clock.now()`, the imported `withOwnedScope`
helper, and Node's `assert`:

```ts
await withOwnedScope(
  () => builder.replace('clock', () => ({ now: () => 7 })).build(),
  (scope) => {
    const value: number = scope.resolve('result');
    assert.equal(value, 7);
  },
);
```

The integration suite verifies that a private module consumer sees the override
and that transient acquisitions remain distinct. An incompatible replacement
still fails through the ordinary compiler contracts. Each fixture owns its bag
and closes it even when an assertion throws; no global container reset is needed.

Nest's TestingModule and Angular's TestBed also manage their framework's controller,
component, template and application environments. This recipe covers DI fixture
ownership and substitution; use the framework's test harness for those additional
environments. See [Nest testing](https://docs.nestjs.com/fundamentals/testing) and
[Angular TestBed](https://angular.dev/api/core/testing/TestBed).

## Application-owned dynamic feature lifecycle

The tested sequence is:

```text
dynamic import -> validate plugin descriptor -> install typed module
-> start selected exports -> use exports/contributions -> close owning bag
```

[`enterprise-feature.ts`](../../tests/fixtures/enterprise-feature.ts) is loaded
through an actual `import()` in the integration suite. It validates an unknown
plugin descriptor with `fromPlugin`, binds the result to a private typed token,
uses a private owned provider in an ordered contribution, and exports a handler.
The host installs the returned module before `buildAndStart(['handler'])`. On completion,
the handler, private provider and plugin are each disposed exactly once.

A statically known dynamic-import path retains its module's TypeScript contract.
An arbitrary configuration-selected path remains unknown and must cross the
runtime validation boundary. Descriptor `apiVersion: 1` identifies the DI Bag
plugin protocol; validate any application-specific plugin version and output
contract yourself. A predicate is the application's assertion about runtime
data, not a TypeScript proof of unknown code.

Closing the bag unloads its owned resources. It does not remove the JavaScript
module from the runtime's import cache or mutate an existing bag's graph. Use
fresh owning bags for independently activated features and pass shared host
resources as borrowed values with explicit owner lifetime. Nest's cached lazy
module loading and Inversify's mutable load/unload have different graph semantics;
see [Nest lazy modules](https://docs.nestjs.com/fundamentals/lazy-loading-modules)
and [Inversify ContainerModule](https://inversify.io/docs/api/container-module/).

## Framework boundaries

In NestJS, request context IDs and the transport determine scope admission; in
Angular, a component, route or environment injector determines provider ownership.
Bridge those host events to the explicit recipe above if embedding DI Bag. A
native framework adapter should additionally test disconnect/destruction,
streaming and error propagation against the actual framework version. The repo
does not ship or claim tested direct NestJS/Angular adapters. [Nest scopes](https://docs.nestjs.com/fundamentals/injection-scopes),
[Angular hierarchy](https://angular.dev/guide/di/hierarchical-dependency-injection).

Run the complete executable recipe checks with:

```sh
bun test tests/enterprise-integration.test.ts
npm run typecheck
```
