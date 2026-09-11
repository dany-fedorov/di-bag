# A programmable DI layer for custom tooling

[Why DI Bag?](../../README.md#why-di-bag) · [Comparison](comparison.md) ·
[Metadata and inspection](tutorial.md#attach-metadata-and-inspect-without-resolving)

DI Bag's metadata, inspection, provider wrappers, and configurable observers give
coding agents building blocks for custom application tooling: inspectors,
diagnostics, and metadata-driven actions tailored to your workflow, without
coupling those tools to service implementations.

The examples below show command catalogs, acquisition diagnostics, and reusable
telemetry conventions that you can extend with application code. They demonstrate
the DI-layer APIs, not an agent-harness integration. To expose their output to an
agent, connect them to your harness's tool interface. Here,
“reflection” means inspecting declared provider metadata and acquisition state.
It does not recover erased TypeScript types or inspect arbitrary service objects.

Each example below is an independent program for Node or Bun. Follow the
[installation instructions](../../README.md#install), install TypeScript 6.0.3 or
newer and `@types/node`, and save one block as `example.ts`. Check and compile it
with `npx tsc example.ts --strict --skipLibCheck --target ES2022 --module NodeNext --outDir out`,
then run `node out/example.js`; alternatively, run `bun example.ts` after type
checking. The adapters and data are deterministic in-memory implementations,
so these programs need no network or third-party SDK.

## 1. List operational commands without constructing their services

A support console needs to show its available commands before an operator chooses
one. It also needs to distinguish read access from commands that change data.
Attaching that description to the registration keeps the catalog and dispatch
policy next to the factory. Listing or rejecting a command should not construct
its service or run its operation.

```ts
import assert from 'node:assert/strict';
import { DiBag } from 'di-bag/node';

type Role = 'support' | 'operator';
type Command = () => string;
interface CommandPolicy {
  title: string;
  role: Role;
  mutatesData: boolean;
}

async function main() {
  const orders = [
    { id: 'order-101', customer: 'Ada', totalCents: 1800 },
    { id: 'order-102', customer: 'Lin', totalCents: 2400 },
  ];
  const searchIndex = new Map<string, string>();
  const constructed: string[] = [];
  const app = DiBag.createBuilder().register({
    orderSummary: DiBag.withMetadata(
      (): Command => {
        constructed.push('orderSummary');
        return () => {
          const total = orders.reduce((sum, order) => sum + order.totalCents, 0);
          return `${orders.length} orders; USD ${total} cents`;
        };
      },
      { static: { 'app:command': {
        title: 'Summarize orders', role: 'support', mutatesData: false,
      } satisfies CommandPolicy } },
    ),
    rebuildSearch: DiBag.withMetadata(
      (): Command => {
        constructed.push('rebuildSearch');
        return () => {
          searchIndex.clear();
          for (const order of orders) searchIndex.set(order.id, order.customer);
          return `Indexed ${searchIndex.size} orders`;
        };
      },
      { static: { 'app:command': {
        title: 'Rebuild order search', role: 'operator', mutatesData: true,
      } satisfies CommandPolicy } },
    ),
  }).build();

  // The application explicitly selects the public commands in this console.
  const names: ('orderSummary' | 'rebuildSearch')[] = [
    'orderSummary', 'rebuildSearch',
  ];
  function dispatch(name: typeof names[number], role: Role): string {
    const policy = app.inspect(name).registrationMetadata['app:command'];
    if (role !== 'operator' && role !== policy.role) {
      throw new Error(`Role ${role} cannot run ${name}`);
    }
    return app.resolve(name)();
  }

  try {
    const catalog = names.map(name => ({
      name, ...app.inspect(name).registrationMetadata['app:command'],
    }));
    assert.deepEqual(catalog.map(item => item.title), [
      'Summarize orders', 'Rebuild order search',
    ]);
    assert.deepEqual(constructed, []);
    assert.throws(() => dispatch('rebuildSearch', 'support'), /cannot run/);
    assert.deepEqual(constructed, []);
    assert.equal(searchIndex.size, 0);
    const summary = dispatch('orderSummary', 'support');
    assert.equal(summary, '2 orders; USD 4200 cents');
    assert.deepEqual(constructed, ['orderSummary']);
    const rebuilt = dispatch('rebuildSearch', 'operator');
    assert.equal(rebuilt, 'Indexed 2 orders');
    assert.equal(searchIndex.get('order-102'), 'Lin');
    console.log(summary);
    console.log(rebuilt);
  } finally {
    await app.close();
  }
}

void main().catch(error => { console.error(error); process.exitCode = 1; });
```

The output is `2 orders; USD 4200 cents`, followed by `Indexed 2 orders`. Static
inspection runs no factories, so the console can display descriptions and apply
its policy before acquiring a command. The dispatcher is application code: DI
Bag does not authenticate callers, enforce roles, or implement a command router.
An actual host must supply a trusted authenticated role. The explicit `names`
list selects public bindings; inspection does not automatically publish private
module helpers or enumerate their metadata.

## 2. Diagnose configuration readiness and provenance after projection

A checkout service uses a last-known-good pricing configuration during a remote
configuration outage. Business code needs the pricing values; an operator needs
to know which revision supplied them and whether loading has finished. Dynamic
metadata records those acquisition facts while a projection exposes only the
configuration the checkout service uses.

```ts
import assert from 'node:assert/strict';
import { DiBag } from 'di-bag/node';

interface Pricing {
  shippingCents: number;
  freeShippingFromCents: number;
}
interface LoadedPricing {
  value: Pricing;
  origin: string;
  revision: string;
}
function gate() {
  let release!: () => void;
  const promise = new Promise<void>(resolve => { release = resolve; });
  return { promise, release };
}

async function main() {
  const loading = gate();
  let attempts = 0;
  const cached: LoadedPricing = {
    value: { shippingCents: 500, freeShippingFromCents: 5000 },
    origin: 'last-known-good', revision: 'pricing-2026-09-08',
  };
  // Deterministic adapter: the remote service is unavailable for this run.
  async function fetchRemote(): Promise<LoadedPricing> {
    throw new Error('Configuration service unavailable');
  }
  async function loadPricing(): Promise<LoadedPricing> {
    attempts++;
    await loading.promise;
    try { return await fetchRemote(); }
    catch { return cached; }
  }
  const described = DiBag.withMetadata(loadPricing, {
    static: { 'app:owner': 'checkout', 'app:purpose': 'shipping prices' },
    dynamic: {
      mode: 'awaited',
      describe: loaded => ({ origin: loaded.origin, revision: loaded.revision }),
    },
  });
  const pricing = DiBag.transformService(described, {
    mode: 'awaited', transform: loaded => loaded.value,
  });
  const app = DiBag.createBuilder().register({
    pricing,
    quote: async ({ pricing }: { pricing: Promise<Pricing> }) => {
      const rates = await pricing;
      return (subtotalCents: number) => subtotalCents +
        (subtotalCents >= rates.freeShippingFromCents ? 0 : rates.shippingCents);
    },
  }).build();

  try {
    const untouched = app.inspect('pricing');
    assert.deepEqual(untouched.acquisitions, []);
    assert.equal(attempts, 0);
    const pending = app.resolve('pricing');
    assert.equal(app.resolve('pricing'), pending);
    const loadingSnapshot = app.inspect('pricing');
    assert.equal(loadingSnapshot.acquisitions[0]?.state, 'pending');
    assert.deepEqual(loadingSnapshot.acquisitions[0]?.acquisitionMetadata, [
      { present: false },
    ]);
    loading.release();
    const rates = await pending;
    assert.deepEqual(rates, cached.value);
    const ready = app.inspect('pricing');
    assert.equal(ready.acquisitions[0]?.state, 'ready');
    const provenance = ready.acquisitions[0]?.acquisitionMetadata[0];
    assert.ok(provenance?.present);
    assert.equal(provenance.value.origin, 'last-known-good');
    assert.equal(provenance.value.revision, 'pricing-2026-09-08');
    assert.equal(loadingSnapshot.acquisitions[0]?.state, 'pending');
    assert.deepEqual(untouched.acquisitions, []);
    const quote = await app.resolve('quote');
    assert.equal(quote(2500), 3000);
    assert.equal(quote(6000), 6000);
    assert.equal(attempts, 1);
    console.log(`${provenance.value.origin}: ${provenance.value.revision}`);
    console.log(`2500-cent basket: ${quote(2500)} cents delivered`);
  } finally {
    loading.release(); // Allow a pending acquisition to finish on assertion failure.
    await app.close();
  }
  assert.deepEqual(app.inspect('pricing').acquisitions, []);
  assert.equal(app.inspect('pricing').registrationMetadata['app:owner'], 'checkout');
}

void main().catch(error => { console.error(error); process.exitCode = 1; });
```

The output is `last-known-good: pricing-2026-09-08`, followed by
`2500-cent basket: 3000 cents delivered`. The metadata survives projection, and
each inspection is a snapshot: taking another snapshot is how the operator sees
the transition to ready. Inspection exposes no service values; `describe` chooses
the facts to publish. These facts describe acquisition, not ongoing service health.
Failed attempts are evicted and closed bags have empty acquisition lists, so use
observers or application storage for historical diagnostics. The fallback and its
acceptance policy belong to this adapter; DI Bag does not choose configuration
sources. Metadata records are shallow copies, and their callbacks must return
synchronous plain records even in `awaited` mode.

## 3. Package a connection convention and configure telemetry per application

A reporting application wants every reporting connection to carry a metric name
and an explicit closer. A reusable registration helper can attach that convention.
Two configured observers then count acquisitions and export telemetry using the
metadata, without adding logging calls to the connection implementation. A failed
telemetry export must be observable while allowing application cleanup to finish.

```ts
import assert from 'node:assert/strict';
import { DiBag, type ObserverFailure } from 'di-bag/node';

interface ConnectionOptions { region: string }
interface Reports { countOpenOrders(): number; close(): void }
function gate() {
  let release!: () => void;
  const promise = new Promise<void>(resolve => { release = resolve; });
  return { promise, release };
}
function reportingConnection(
  create: (deps: { options: ConnectionOptions }) => Promise<Reports>,
  metricName: string,
) {
  return DiBag.withMetadata(DiBag.withDisposal(create, client => client.close()), {
    static: { 'app:metric': metricName, 'app:owner': 'reporting' },
  });
}
function metricName(metadata: Readonly<object>): string | undefined {
  if ('app:metric' in metadata && typeof metadata['app:metric'] === 'string') {
    return metadata['app:metric'];
  }
  return undefined;
}

async function main() {
  const counts = new Map<string, number>();
  const failures: ObserverFailure[] = [];
  const closeDelivered = gate();
  const exportAllowed = gate();
  const failureDelivered = gate();
  const unavailable = new Error('Telemetry exporter unavailable');
  let exportFinished = false;
  let exportFinishedAtClose = false;
  let connectionsClosed = 0;
  const metrics = DiBag.withConfiguration({ observers: [{
    onEvent(event) {
      if (event.kind !== 'acquisition-ready') return;
      const name = metricName(event.registrationMetadata);
      if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
    },
    onError(failure) { failures.push(failure); },
  }] });
  // This creates another facade and appends an observer to the metrics facade.
  const reporting = metrics.withConfiguration({ observers: [{
    async onEvent(event) {
      if (event.kind === 'scope-closed') closeDelivered.release();
      if (event.kind !== 'acquisition-ready') return;
      if (metricName(event.registrationMetadata) !== 'reports.open') return;
      await exportAllowed.promise;
      exportFinished = true;
      throw unavailable; // Deterministic failed export, without a network call.
    },
    onError(failure) {
      failures.push(failure);
      failureDelivered.release();
    },
  }] });
  const reports = reportingConnection(async ({ options }) => {
    assert.equal(options.region, 'eu');
    let closed = false;
    const orders = [{ open: true }, { open: false }, { open: true }];
    return {
      countOpenOrders() {
        assert.equal(closed, false);
        return orders.filter(order => order.open).length;
      },
      close() { closed = true; connectionsClosed++; },
    };
  }, 'reports.open');
  const app = reporting.createBuilder().register({
    options: () => ({ region: 'eu' }), reports,
  }).alias('dashboard', 'reports').build();

  try {
    const client = await app.resolve('dashboard');
    assert.equal(client.countOpenOrders(), 2);
    assert.equal(await app.resolve('reports'), client);
    assert.equal(app.inspect('reports').registrationMetadata['app:owner'], 'reporting');
  } finally {
    try {
      await app.close();
      await closeDelivered.promise;
      exportFinishedAtClose = exportFinished;
    } finally {
      exportAllowed.release();
    }
  }
  // close() does not wait for observer work; this application owns its barrier.
  await failureDelivered.promise;
  assert.equal(exportFinishedAtClose, false);
  assert.equal(connectionsClosed, 1);
  assert.equal(counts.get('reports.open'), 1);
  assert.equal(failures.length, 1);
  assert.equal(failures[0]?.error, unavailable);
  assert.equal(failures[0]?.event.kind, 'acquisition-ready');
  assert.notEqual(reporting, metrics);
  assert.notEqual(metrics, DiBag);
  console.log('reports.open: 1 acquisition; 1 connection closed');
  console.log('Telemetry export failed and was reported separately');
}

void main().catch(error => { console.error(error); process.exitCode = 1; });
```

The output is `reports.open: 1 acquisition; 1 connection closed`, followed by
`Telemetry export failed and was reported separately`. The helper preserves the
factory's declared `options` dependency and makes ownership explicit. Resolving
through the alias and the original name records one cached acquisition.
`withConfiguration` preserves inherited Node/Bun Promise classification and adds
observers to a new facade; existing facades and builders keep their configuration.

Observers are asynchronous telemetry hooks, not middleware that can veto a service
or enforce a policy. They can report internal module acquisitions, but that does
not make private bindings available to public `inspect` or `resolve` calls.
Event metadata is heterogeneous, hence the small runtime check for `app:metric`.
Callbacks should stay small; a producer that continuously outruns its exporter
needs an application-defined buffering or dropping policy. `withDisposal` supplies
the ownership here; metadata alone does not close resources, and cleanup still
depends on a cooperative closer.
