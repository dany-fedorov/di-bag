# Integration patterns: dynamic features, fixtures, and framework boundaries {#request-containers-test-fixtures-and-dynamic-features}

[← README](../../README.md) · [API guide](api-reference.md) · [Server recipes](server-integration.md)

Load a feature with `import()`, validate its plugin descriptor, install it as a typed module,
make its exports ready, and close it. Closing disposes the plugin and every private
provider exactly once. `tests/enterprise-integration.test.ts` runs this sequence through a
real dynamic import. The block below compiles in CI and runs as is.

```ts
import assert from 'node:assert/strict';
import { DiBag } from 'di-bag';

type Transform = (text: string) => string;
const pluginKey = Symbol('feature-plugin');
const plugin = DiBag.createToken(pluginKey).forService<Transform>();

// In an application this value comes from `await import(configuredPath)`.
const descriptor: unknown = {
  apiVersion: 1,
  create: (): Transform => text => text.toUpperCase(),
  dispose: () => console.log('plugin disposed'),
};

const feature = DiBag.createBuilder()
  .withTokenService(plugin, DiBag.createProviderFromPlugin({
    dependencies: [],
    pluginDescriptor: descriptor,
    factoryReturnKind: 'uninspected',
    isValidPluginOutput: (value: unknown): value is Transform => typeof value === 'function',
  }))
  .withServices({
    handler: DiBag.createProviderFromFunction({
      dependencies: [plugin],
      factoryFunction: (transform: Transform) => (text: string) => `${transform(text)}!`,
    }),
  })
  .buildModule({ exportedServiceKeys: ['handler'], moduleLabel: 'feature' });

const app = await DiBag.createBuilder()
  .withInstalledModules([feature])
  .buildContainer()
  .ensureServicesReady(['handler']);
try {
  assert.equal(app.resolve('handler')('ok'), 'OK!');
} finally {
  await app.close(); // disposes the plugin once
}
```

## One child container per operation {#one-child-container-per-operation}

Requests, jobs, and messages share one ownership shape: open a child container, run the
work, close the child, and keep both errors if both fail. The
[server guide](server-integration.md#close-each-request-container) builds it step by step;
[`examples/integration/owned-container.ts`](../../examples/integration/owned-container.ts)
is the tested `withOwnedContainer` helper. Two facts are specific to
embedding: never pass the shared application container as `acquire()` for a request or job; only the shutdown path owns it. A failed
`ensureServicesReady` closes its container itself; on cancellation, await `disposalPromise`.

## Checked test substitutions

Tests use the same checked builder and container APIs as applications. This block replaces a
private module's `clock` dependency in an independent container:

```ts
import assert from 'node:assert/strict';
import { DiBag } from 'di-bag';

type Clock = { now(): number };

const reader = DiBag.createBuilder()
  .withServices({
    privateRead: ({ clock }: { clock: Clock }) => clock.now(),
    result: ({ privateRead }: { privateRead: number }) => privateRead,
  })
  .buildModule({ exportedServiceKeys: ['result'], moduleLabel: 'reader' });

const original = DiBag.createBuilder()
  .withInstalledModules([reader])
  .withServices({ clock: (): Clock => ({ now: () => Date.now() }) })
  .buildContainer();
const fixture = original.createIndependentContainer(['clock'], {
  clock: (): Clock => ({ now: () => 7 }),
});
try {
  const value: number = fixture.resolve('result');
  assert.equal(value, 7);
} finally {
  await fixture.close();
  await original.close();
}
```

The integration suite verifies this with both `createIndependentContainer` and `builder.withReplacedService`.
The fixture and original are independent owners, so close both even when an assertion throws.
No global container reset is needed.

Nest's TestingModule and Angular's TestBed also manage their framework's controller,
component, template and application environments. This recipe covers DI fixture
ownership and substitution; use the framework's test harness for those additional
environments. See [Nest testing](https://docs.nestjs.com/fundamentals/testing) and
[Angular TestBed](https://angular.dev/api/core/testing/TestBed).

## Application-owned dynamic feature lifecycle

The opening example shows the sequence with an inline descriptor. The test fixture
[`enterprise-feature.ts`](../../tests/fixtures/enterprise-feature.ts) is loaded
through an actual `import()` in the integration suite. It validates an unknown
plugin descriptor with `DiBag.createProviderFromPlugin`, binds the result to a private typed token,
uses a private owned provider in an ordered contribution, and exports a handler.
The host installs the returned module before `buildContainer()` and `ensureServicesReady(['handler'])`. On completion,
the handler, private provider and plugin are each disposed exactly once.

A statically known dynamic-import path retains its module's TypeScript contract.
An arbitrary configuration-selected path remains unknown and must cross the
runtime validation boundary. Descriptor `apiVersion: 1` identifies the DI Bag
plugin protocol; validate any application-specific plugin version and output
contract yourself. A predicate is the application's assertion about runtime
data, not a TypeScript proof of unknown code.

Closing the container unloads its owned resources. It does not remove the JavaScript
module from the runtime's import cache or mutate an existing container's graph. Use
fresh owning containers for independently activated features and pass shared host
resources as borrowed values with explicit owner lifetime. Nest's cached lazy
module loading and Inversify's mutable load/unload have different graph semantics;
see [Nest lazy modules](https://docs.nestjs.com/fundamentals/lazy-loading-modules)
and [Inversify ContainerModule](https://inversify.io/docs/api/container-module/).

## Framework boundaries

In NestJS, request context IDs and the transport determine request admission; in
Angular, a component, route or environment injector determines provider ownership.
Bridge those host events to the explicit recipe above if embedding DI Bag. A
native framework adapter should additionally test disconnect/destruction,
streaming and error propagation against the actual framework version. The repo
does not ship or claim tested direct NestJS/Angular adapters. [Nest provider lifetimes](https://docs.nestjs.com/fundamentals/injection-scopes),
[Angular hierarchy](https://angular.dev/guide/di/hierarchical-dependency-injection).

For React in the browser, the [React guide](react-integration.md) ships a tested
owner that bridges effect setup and disposal to service readiness and close.

Run the complete executable recipe checks with:

```sh
bun test tests/enterprise-integration.test.ts
npm run typecheck
```
