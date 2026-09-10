# TypeScript first: catch composition errors at compile time

[Why DI Bag?](../../README.md#why-di-bag) · [Comparison](comparison.md)

These three independent TypeScript programs run in Node or Bun after following
the [installation instructions](../../README.md#install). Save each block in its
own `.mts` file. Enable TypeScript `strict` checking and Node types; type-check
before running with Node 24 or Bun, because those runtimes do not type-check code.
Every adapter below is an in-memory demonstration with no external service or
network dependency.

Each program contains an uncalled `rejectedWiring` function. Its
`@ts-expect-error` directives document deliberately invalid composition and make
the compiler check that those lines really fail. Remove a directive to inspect
the error. Leave the function uncalled: invalid composition is not executable
application code.

## 1. An invoice reminder job cannot start without its mailer

A billing worker finds overdue invoices and sends reminders. Its business factory
is registered first, while the application's composition root supplies a store,
clock, and mailer. Forgetting the mailer must be visible before the scheduled job
runs, even though no service has been resolved yet.

```ts
import assert from 'node:assert/strict';
import { DiBag } from 'di-bag/node';

type Invoice = {
  id: string;
  email: string;
  dueAt: number;
  paid: boolean;
};
type InvoiceStore = { list(): Promise<readonly Invoice[]> };
type Message = { to: string; subject: string };
type Mailer = { send(message: Message): Promise<void> };
type Clock = { now(): number };

function createReminderJob({ invoices, mailer, clock }: {
  invoices: InvoiceStore;
  mailer: Mailer;
  clock: Clock;
}) {
  return {
    async run(): Promise<string[]> {
      const sentIds: string[] = [];
      const now = clock.now();
      for (const invoice of await invoices.list()) {
        if (invoice.paid || invoice.dueAt > now) continue;
        await mailer.send({
          to: invoice.email,
          subject: `Payment reminder: ${invoice.id}`,
        });
        sentIds.push(invoice.id);
      }
      return sentIds;
    },
  };
}

const now = Date.parse('2026-09-10T09:00:00Z');
const rows: readonly Invoice[] = [
  { id: 'INV-101', email: 'ada@example.test', dueAt: now - 1, paid: false },
  { id: 'INV-102', email: 'lin@example.test', dueAt: now + 1, paid: false },
  { id: 'INV-103', email: 'sam@example.test', dueAt: now - 1, paid: true },
];
const outbox: Message[] = [];
let mailerCreations = 0;

const incomplete = DiBag.createBuilder()
  .register({ reminders: createReminderJob })
  .register({
    invoices: (): InvoiceStore => ({ list: async () => rows }),
    clock: (): Clock => ({ now: () => now }),
  });

function rejectedWiring() {
  // @ts-expect-error The reminders factory still requires a mailer.
  incomplete.build();
}

const app = incomplete.register({
  mailer: (): Mailer => {
    mailerCreations += 1;
    return { send: async (message) => { outbox.push(message); } };
  },
}).build();

try {
  assert.equal(mailerCreations, 0);
  assert.deepEqual(await app.resolve('reminders').run(), ['INV-101']);
  assert.deepEqual(outbox, [{
    to: 'ada@example.test',
    subject: 'Payment reminder: INV-101',
  }]);
  assert.equal(mailerCreations, 1);
} finally {
  await app.close();
}
```

The incomplete builder is allowed while composition is in progress. Calling
`build()` on it fails the type check because `mailer` is absent. Registering that
provider completes the graph, even though the consumer was registered first.
The assertions also show that building does not eagerly create the mailer.

The parameter type is the dependency declaration: DI Bag can check only what you
express there. It cannot prove delivery, prevent duplicate reminders on a second
run, or decide your retry policy. Those remain application concerns.

## 2. A legacy inventory adapter must return the contract consumers expect

A warehouse's old inventory representation stores quantities as strings. A picking
service expects numeric quantities and asynchronous lookup. Naming both providers
`inventory` is insufficient: the returned methods must satisfy the consumer's
contract. An adapter makes that conversion explicit and validates malformed data.

```ts
import assert from 'node:assert/strict';
import { DiBag } from 'di-bag/node';

type Inventory = { available(sku: string): Promise<number> };
type RequestedLine = { sku: string; quantity: number };
type PlannedLine = RequestedLine & { available: number };

function createPickingService({ inventory }: { inventory: Inventory }) {
  return {
    async plan(lines: readonly RequestedLine[]): Promise<PlannedLine[]> {
      const planned: PlannedLine[] = [];
      for (const line of lines) {
        if (!Number.isSafeInteger(line.quantity) || line.quantity <= 0) {
          throw new Error(`Invalid requested quantity: ${line.sku}`);
        }
        const available = await inventory.available(line.sku);
        if (line.quantity > available) {
          throw new Error(`Insufficient stock: ${line.sku}`);
        }
        planned.push({ ...line, available });
      }
      return planned;
    },
  };
}

// In-memory stand-in for the legacy data source; unknown SKUs have no stock.
const quantities = new Map<string, string>([
  ['NOTEBOOK', '12'],
  ['PENCIL', '3'],
  ['BROKEN-ROW', 'many'],
]);
const legacyInventory = {
  async available(sku: string): Promise<string> {
    return quantities.get(sku) ?? '0';
  },
};
const feature = DiBag.createBuilder().register({ picking: createPickingService });

function rejectedWiring() {
  // @ts-expect-error Promise<string> does not satisfy Promise<number>.
  feature.register({ inventory: () => legacyInventory });
}

function createInventoryAdapter(): Inventory {
  return {
    async available(sku) {
      const raw = await legacyInventory.available(sku);
      if (!/^\d+$/.test(raw)) throw new Error(`Invalid stock data: ${sku}`);
      const count = Number(raw);
      if (!Number.isSafeInteger(count)) {
        throw new Error(`Stock count out of range: ${sku}`);
      }
      return count;
    },
  };
}

const app = feature.register({ inventory: createInventoryAdapter }).build();
try {
  const picking = app.resolve('picking');
  assert.deepEqual(await picking.plan([
    { sku: 'NOTEBOOK', quantity: 4 },
    { sku: 'PENCIL', quantity: 2 },
  ]), [
    { sku: 'NOTEBOOK', quantity: 4, available: 12 },
    { sku: 'PENCIL', quantity: 2, available: 3 },
  ]);
  await assert.rejects(
    () => picking.plan([{ sku: 'PENCIL', quantity: 4 }]),
    /Insufficient stock: PENCIL/,
  );
  await assert.rejects(
    () => picking.plan([{ sku: 'BROKEN-ROW', quantity: 1 }]),
    /Invalid stock data: BROKEN-ROW/,
  );
} finally {
  await app.close();
}
```

The incompatible provider is rejected at `register()`, where its string result
meets the already-declared numeric requirement. The corrected adapter returns the
required `Promise<number>`; TypeScript checks the asynchronous contract as well as
the method name.

Types do not validate the contents of legacy records. The parser and rejection
assertion cover that separate boundary. This program plans picks only; reserving
stock under concurrent orders would require an atomic operation in the inventory
contract and its backing store.

## 3. A payment test replaces a gateway without breaking checkout

A checkout service writes a receipt only after an approved payment. Test its
decline path with a fork that replaces the gateway, keeping the same checkout
factory. The gateway contract is explicit so tests depend on the service API,
rather than incidental details of a particular adapter.

```ts
import assert from 'node:assert/strict';
import { DiBag } from 'di-bag/node';

type Charge = { orderId: string; amountCents: number };
type ChargeResult = {
  status: 'approved' | 'declined';
  reference: string;
};
type PaymentGateway = { charge(input: Charge): Promise<ChargeResult> };
type Receipt = Charge & { paymentReference: string };
type ReceiptStore = Map<string, Receipt>;

function createCheckout({ gateway, receipts }: {
  gateway: PaymentGateway;
  receipts: ReceiptStore;
}) {
  return {
    async pay(input: Charge): Promise<Receipt> {
      if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0) {
        throw new Error('Amount must be a positive integer number of cents');
      }
      const result = await gateway.charge(input);
      if (result.status !== 'approved') throw new Error('Payment declined');
      const receipt = { ...input, paymentReference: result.reference };
      receipts.set(input.orderId, receipt);
      return receipt;
    },
  };
}

// Local demonstration gateway: no payment processor is contacted.
const app = DiBag.createBuilder().register({
  gateway: (): PaymentGateway => ({
    charge: async ({ orderId }) => ({
      status: 'approved',
      reference: `demo-${orderId}`,
    }),
  }),
  receipts: (): ReceiptStore => new Map(),
  checkout: createCheckout,
}).build();

function rejectedWiring() {
  const wrongGateway = () => ({ charge: async () => 'declined' });
  // @ts-expect-error A string result cannot replace the structured charge result.
  app.fork(['gateway'], { gateway: wrongGateway });
}

try {
  const parentCheckout = app.resolve('checkout');
  const recordedCharges: Charge[] = [];
  const testApp = app.fork(['gateway'], {
    gateway: (): PaymentGateway => ({
      async charge(input) {
        recordedCharges.push(input);
        return { status: 'declined', reference: 'test-decline' };
      },
    }),
  });

  try {
    const input = { orderId: 'ORDER-101', amountCents: 2499 };
    const testCheckout = testApp.resolve('checkout');
    assert.notEqual(testCheckout, parentCheckout);
    await assert.rejects(() => testCheckout.pay(input), /Payment declined/);
    assert.deepEqual(recordedCharges, [input]);
    assert.equal(testApp.resolve('receipts').size, 0);

    const receipt = await parentCheckout.pay(input);
    assert.deepEqual(receipt, { ...input, paymentReference: 'demo-ORDER-101' });
    assert.deepEqual(app.resolve('receipts').get(input.orderId), receipt);
    assert.notEqual(app.resolve('receipts'), testApp.resolve('receipts'));
    assert.equal(testApp.resolve('receipts').size, 0);
    assert.equal(recordedCharges.length, 1);
  } finally {
    await testApp.close();
  }
} finally {
  await app.close();
}
```

`fork()` checks the replacement against the existing gateway's exposed contract.
The wrong return shape fails at the fork call. The valid replacement drives the
same checkout code through a decline while the parent still approves payments.
The assertions confirm that the fork creates fresh checkout and receipt-store
instances; each bag is closed separately.

Fresh factories do not clone objects captured outside those factories. The receipt
map is allocated inside its factory to keep test state independent. A real payment
integration would also need idempotency, durable receipt storage, and recovery for
a successful charge followed by a failed write; static wiring checks cannot prove
those behaviors. See the [comparison guide](comparison.md#what-type-safe-means-here)
for the broader limits of compile-time composition.
