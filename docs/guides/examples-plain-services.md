# Inject anything with plain JavaScript

[Why DI Bag?](../../README.md#why-di-bag) · [Comparison](comparison.md)

Your services can be functions, class instances, configuration objects, built-in
collections, or asynchronously initialized clients. They need no decorators,
special base classes, or reflection metadata. A small factory at the composition
boundary tells DI Bag how to supply each service's dependencies.

The three examples below are plain JavaScript: save any one block as an `.mjs`
file in a Node application with `di-bag` installed and run it with Node 24. Each
block is independent, includes its data and assertions, and closes its bag.
See the [installation instructions](../../README.md#install) to install this
checkout. The notification and reporting adapters run entirely in memory; they
demonstrate application contracts without requiring an email service or database.

JavaScript gets the runtime composition behavior. Compile-time graph checks need
TypeScript, or JavaScript with suitable JSDoc declarations and TypeScript checking
enabled. These unannotated examples do not claim static dependency validation.

## 1. Reuse existing billing functions without changing their API

A billing application already has a pricing function and an invoice issuer used
by batch jobs. Its web entry point needs to supply the same currency rules and
money formatter. The functions take ordinary positional arguments and know
nothing about a container; only the final registration adapts named dependencies
to those arguments.

```js
import assert from 'node:assert/strict';
import { DiBag } from 'di-bag/node';

// Existing application functions; neither depends on DI Bag.
function priceInvoice(lines, rules) {
  const subtotalCents = lines.reduce((total, line) => {
    if (!Number.isInteger(line.quantity) || line.quantity < 1) {
      throw new Error('Invoice quantities must be positive integers');
    }
    return total + line.quantity * line.unitPriceCents;
  }, 0);
  const taxCents = Math.round(subtotalCents * rules.vatBasisPoints / 10_000);
  return { subtotalCents, taxCents, totalCents: subtotalCents + taxCents };
}

function createInvoiceIssuer(rules, price, format) {
  return (order) => {
    const totals = price(order.lines, rules);
    if (totals.totalCents < rules.minimumInvoiceCents) {
      throw new Error('Order is below the minimum invoice amount');
    }
    return {
      id: `invoice-${order.id}`,
      customerId: order.customerId,
      currency: rules.currency,
      ...totals,
      displayTotal: format(totals.totalCents, rules.currency),
    };
  };
}

const rules = Object.freeze({
  currency: 'EUR', vatBasisPoints: 2_000, minimumInvoiceCents: 1_000,
});
const formatMoney = (cents, currency) => `${currency} ${(cents / 100).toFixed(2)}`;
const order = {
  id: 'order-41', customerId: 'customer-8',
  lines: [
    { sku: 'hosting-month', quantity: 2, unitPriceCents: 2_500 },
    { sku: 'storage-addon', quantity: 1, unitPriceCents: 500 },
  ],
};

const app = DiBag.createBuilder().register({
  rules: () => rules,
  price: () => priceInvoice,
  format: () => formatMoney,
  issueInvoice: ({ rules, price, format }) =>
    createInvoiceIssuer(rules, price, format),
}).build();

try {
  const issue = app.resolve('issueInvoice');
  assert.equal(app.resolve('price'), priceInvoice);
  assert.equal(app.resolve('rules'), rules);
  assert.deepEqual(issue(order), {
    id: 'invoice-order-41', customerId: 'customer-8', currency: 'EUR',
    subtotalCents: 5_500, taxCents: 1_100, totalCents: 6_600,
    displayTotal: 'EUR 66.00',
  });
  const directIssuer = createInvoiceIssuer(rules, priceInvoice, formatMoney);
  assert.deepEqual(issue(order), directIssuer(order));
  assert.throws(() => issue({
    ...order, lines: [{ sku: 'sample', quantity: 1, unitPriceCents: 100 }],
  }), /minimum invoice/);
  console.log(issue(order).displayTotal); // EUR 66.00
} finally {
  await app.close();
}
```

DI Bag supplies the configuration and both callable dependencies, then returns
the ordinary invoice function. Existing callers can keep using the direct
function API; an application can adopt composition at one entry point.

The wrappers matter: `price: () => priceInvoice` registers the pricing function
as a service value. Registering `priceInvoice` itself would treat it as the
factory. Likewise, configuration is supplied through a factory, not passed as a
raw registration. The invoice policy and its runtime input validation remain
application responsibilities; this simplified tax rule is sample business logic.

## 2. Construct an undecorated notification class

A notification module has an ordinary class whose constructor accepts a recipient
directory, a transport, and sender configuration. The application wants to reuse
that class in a worker and in tests. The following in-memory transport records
outgoing messages so the example can verify delivery and skipped recipients.

```js
import assert from 'node:assert/strict';
import { DiBag } from 'di-bag/node';

class NotificationDispatcher {
  constructor(directory, transport, sender) {
    this.directory = directory;
    this.transport = transport;
    this.sender = sender;
  }

  async orderShipped(order) {
    const recipient = this.directory.get(order.customerId);
    if (!recipient) throw new Error(`Unknown customer: ${order.customerId}`);
    if (!recipient.shippingUpdates) return { status: 'skipped' };
    const receipt = await this.transport.send({
      from: this.sender,
      to: recipient.email,
      subject: `Order ${order.id} has shipped`,
      text: `Hello ${recipient.name}, track your parcel: ${order.trackingUrl}`,
    });
    return { status: 'sent', receipt };
  }
}

// Demonstration adapter with the same send/close boundary a real transport needs.
const outbox = [];
let transportClosed = false;
function openMemoryTransport() {
  return {
    async send(message) {
      if (transportClosed) throw new Error('Transport is closed');
      outbox.push(message);
      return `message-${outbox.length}`;
    },
    close() { transportClosed = true; },
  };
}

const directory = new Map([
  ['customer-8', {
    name: 'Mira', email: 'mira@example.test', shippingUpdates: true,
  }],
  ['customer-9', {
    name: 'Oleh', email: 'oleh@example.test', shippingUpdates: false,
  }],
]);
const app = DiBag.createBuilder().register({
  directory: () => directory,
  sender: () => 'shipping@example.test',
  transport: DiBag.withDisposal(openMemoryTransport, (client) => client.close()),
  notifications: ({ directory, transport, sender }) =>
    new NotificationDispatcher(directory, transport, sender),
}).build();

try {
  const notifications = app.resolve('notifications');
  const order = {
    id: 'order-41', customerId: 'customer-8',
    trackingUrl: 'https://tracking.example.test/parcel-41',
  };
  assert.ok(notifications instanceof NotificationDispatcher);
  assert.equal(notifications.directory, directory);
  assert.deepEqual(await notifications.orderShipped(order), {
    status: 'sent', receipt: 'message-1',
  });
  assert.deepEqual(await notifications.orderShipped({
    ...order, customerId: 'customer-9',
  }), { status: 'skipped' });
  assert.deepEqual(outbox, [{
    from: 'shipping@example.test', to: 'mira@example.test',
    subject: 'Order order-41 has shipped',
    text: 'Hello Mira, track your parcel: https://tracking.example.test/parcel-41',
  }]);
  console.log(outbox.length); // 1
} finally {
  await app.close();
}
assert.equal(transportClosed, true);
```

The factory uses JavaScript's normal `new` expression. Constructor arguments are
explicit, the returned value keeps its class identity, and the class needs no
decorators, inheritance contract, or reflection metadata. A `Map`, a string, and
a transport object all participate in the same composition.

DI Bag does not infer constructor dependencies from parameter names. The factory
provides them; [`fromClass`](tutorial.md#adapt-classes-and-positional-functions)
is another option when dependencies are declared with typed tokens. The transport
is owned because its registration uses `withDisposal`; a method named `close`
alone does not make DI Bag call it. A production transport must implement its own
delivery, retry, and deduplication policy.

## 3. Combine configuration, a formatter, and an async reporting client

A reporting command needs an asynchronously opened warehouse client, a set of
included sales channels, and a serialization function. These are different value
shapes, but each can be returned by a factory. The in-memory warehouse below
models an async connection boundary without external credentials or network I/O.

```js
import assert from 'node:assert/strict';
import { DiBag } from 'di-bag/node';

const rows = [
  { day: '2026-09-09', channel: 'web', revenueCents: 12_500 },
  { day: '2026-09-09', channel: 'partner', revenueCents: 4_000 },
  { day: '2026-09-09', channel: 'internal', revenueCents: 900 },
  { day: '2026-09-10', channel: 'web', revenueCents: 3_000 },
];
let connections = 0;
let closedConnections = 0;

async function openMemoryWarehouse(dataset) {
  connections += 1;
  await Promise.resolve(); // Model asynchronous initialization deterministically.
  let closed = false;
  return {
    async salesForDay(day) {
      if (closed) throw new Error('Warehouse is closed');
      return dataset.filter((row) => row.day === day).map((row) => ({ ...row }));
    },
    close() { closed = true; closedConnections += 1; },
  };
}

function serializeReport(report) {
  return JSON.stringify(report, null, 2);
}

const app = DiBag.createBuilder().register({
  config: () => ({ currency: 'EUR', channels: new Set(['web', 'partner']) }),
  serialize: () => serializeReport,
  warehouse: DiBag.withDisposal(
    () => openMemoryWarehouse(rows),
    (client) => client.close(),
  ),
  report: async ({ warehouse, config, serialize }) => {
    const client = await warehouse;
    return async (day) => {
      const sales = (await client.salesForDay(day))
        .filter((row) => config.channels.has(row.channel));
      return serialize({
        day,
        currency: config.currency,
        channels: sales.map((row) => row.channel),
        revenueCents: sales.reduce((total, row) => total + row.revenueCents, 0),
      });
    };
  },
}).build();

try {
  assert.equal(connections, 0);
  const reportPromise = app.resolve('report');
  assert.ok(reportPromise instanceof Promise);
  assert.equal(app.resolve('report'), reportPromise);
  const renderReport = await reportPromise;
  const result = JSON.parse(await renderReport('2026-09-09'));
  assert.deepEqual(result, {
    day: '2026-09-09', currency: 'EUR',
    channels: ['web', 'partner'], revenueCents: 16_500,
  });
  assert.equal(JSON.parse(await renderReport('2026-09-10')).revenueCents, 3_000);
  assert.equal(connections, 1);
  assert.equal(app.resolve('serialize'), serializeReport);
  console.log(result.revenueCents); // 16500
} finally {
  await app.close();
}
assert.equal(closedConnections, 1);
```

The async factory exposes a native `Promise`; its consumer explicitly awaits
it. The resolved report is an ordinary callable service, and its dependencies
include an object containing a `Set`, another function, and a client with methods.
`withDisposal` receives the initialized client when the bag closes.

Repeated resolution shares the report's promise in this bag under the default
scoped lifetime. That does not cache individual report results: each call still
queries the adapter. DI Bag also does not validate warehouse rows or guarantee
that an async operation succeeds. For custom thenables and explicit acquisition
modes, see [async boundaries](tutorial.md#async-edges-are-explicit).
