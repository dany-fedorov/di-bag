# Radical modularity for agentic development

In this guide, **radical modularity** means making independently composable,
replaceable, and testable units the normal way to build an application—not an
afterthought. DI Bag modules declare their dependencies, keep unexported services
private to an installation, and expose a small public surface.

That gives a human or coding agent a bounded assignment: implement a feature
against its contracts, test it with controlled dependencies, and integrate it
without reaching into another feature's internals. This is an architectural fit
for agentic development and automated testing, not a measured claim about agent
productivity or generated-code correctness.

The three programs below are independent. After [installing DI Bag](../../README.md#install),
save any block as a TypeScript file and run it with Bun, or compile it as an ES
module and run the output with Node. Each includes executable assertions. The
in-memory adapters make the examples deterministic; no database, payment account,
or language-model API is needed.

## 1. Integrate separately owned fulfillment and invoicing features

Suppose one agent owns fulfillment and another owns invoicing. They agree on the
two exported service contracts; each can choose its own storage implementation.
Both modules below use a private service called `store`, with different shapes.
Neither name leaks into the application or collides with the other installation.

```ts
import assert from 'node:assert/strict';
import { DiBag } from 'di-bag/node';

type Stock = { reserve(sku: string, quantity: number): boolean };
type InvoiceStore = { save(orderId: string, amountCents: number): string };
type Fulfillment = { reserve(sku: string, quantity: number): boolean };
type Invoicing = { issue(orderId: string, amountCents: number): string };

// fulfillment/module.ts: owned by the fulfillment team or agent.
const fulfillmentModule = DiBag.createBuilder()
  .register({
    store: (): Stock => {
      const quantities = new Map([['coffee', 4]]);
      return {
        reserve(sku, quantity) {
          const available = quantities.get(sku) ?? 0;
          if (quantity <= 0 || quantity > available) return false;
          quantities.set(sku, available - quantity);
          return true;
        },
      };
    },
    fulfillment: ({ store }: { store: Stock }): Fulfillment => ({
      reserve: (sku, quantity) => store.reserve(sku, quantity),
    }),
  })
  .buildModule(['fulfillment']);

// invoicing/module.ts: a separate implementation and private store.
const invoicingModule = DiBag.createBuilder()
  .register({
    store: (): InvoiceStore => {
      const invoices = new Map<string, number>();
      return {
        save(orderId, amountCents) {
          if (invoices.has(orderId)) throw new Error('Duplicate invoice');
          invoices.set(orderId, amountCents);
          return `invoice:${orderId}`;
        },
      };
    },
    invoicing: ({ store }: { store: InvoiceStore }): Invoicing => ({
      issue: (orderId, amountCents) => store.save(orderId, amountCents),
    }),
  })
  .buildModule(['invoicing']);

// commerce/module.ts: compose public contracts into another reusable module.
const commerceModule = DiBag.createBuilder()
  .installModule(fulfillmentModule)
  .installModule(invoicingModule)
  .register({
    placeOrder: ({ fulfillment, invoicing }: {
      fulfillment: Fulfillment;
      invoicing: Invoicing;
    }) => (orderId: string, quantity: number) => {
      if (!fulfillment.reserve('coffee', quantity)) return 'out-of-stock';
      return invoicing.issue(orderId, quantity * 1200);
    },
  })
  .buildModule(['placeOrder']);

// app.ts: the application sees only the composed workflow.
const app = DiBag.createBuilder().installModule(commerceModule).build();

try {
  const placeOrder = app.resolve('placeOrder');
  assert.equal(placeOrder('order-1', 3), 'invoice:order-1');
  assert.equal(placeOrder('order-2', 2), 'out-of-stock');
  assert.equal(placeOrder('order-3', 1), 'invoice:order-3');
  console.log('Two independent features composed successfully');
} finally {
  await app.close();
}
```

**What this buys you:** feature implementations can evolve separately while the
integration graph checks their declared contracts. In a real repository, move
the marked sections into separate files and export only the modules and shared
contract types. The module declarations are inert: building them does not create
the stores. The commerce module nests both features and exports only `placeOrder`;
the same builder API handles each level of composition.

**Boundary:** DI Bag's private services are composition boundaries, not a
filesystem access policy or a sandbox for agents. This order workflow also omits
transaction coordination: if invoicing fails after reservation, compensation
belongs to the application, not to dependency injection.

## 2. Run isolated feature tests with controlled external dependencies

A billing agent should be able to test approved and declined payments without
starting the web server or calling a payment provider. The payment contract is
external to the module; its attempt counter stays private. Each test installs the
same behavior through a fresh fork and supplies a different gateway.

```ts
import assert from 'node:assert/strict';
import { DiBag } from 'di-bag/node';

type Gateway = { charge(amountCents: number): Promise<string> };
type Receipt = { status: 'paid' | 'declined'; attempts: number };
type Checkout = { pay(amountCents: number): Promise<Receipt> };

const billingModule = DiBag.createBuilder()
  .register({
    state: () => ({ attempts: 0 }),
    checkout: ({ gateway, state }: {
      gateway: Gateway;
      state: { attempts: number };
    }): Checkout => ({
      async pay(amountCents) {
        if (amountCents <= 0) throw new Error('Amount must be positive');
        state.attempts++;
        // This simplified adapter represents every charge failure as declined.
        try {
          await gateway.charge(amountCents);
          return { status: 'paid', attempts: state.attempts };
        } catch {
          return { status: 'declined', attempts: state.attempts };
        }
      },
    }),
  })
  .buildModule(['checkout']);

let defaultGatewayCreations = 0;
const fixture = DiBag.createBuilder()
  .installModule(billingModule)
  .register({
    gateway: (): Gateway => {
      defaultGatewayCreations++;
      return {
        async charge() {
          throw new Error('The test must supply a gateway');
        },
      };
    },
  })
  .build();

async function runCase(approved: boolean) {
  const chargedAmounts: number[] = [];
  const testApp = fixture.fork(['gateway'], {
    gateway: (): Gateway => ({
      async charge(amountCents) {
        chargedAmounts.push(amountCents);
        if (!approved) throw new Error('Payment declined');
        return 'receipt-1';
      },
    }),
  });

  try {
    const checkout = testApp.resolve('checkout');
    assert.deepEqual(await checkout.pay(2400), {
      status: approved ? 'paid' : 'declined',
      attempts: 1,
    });
    assert.deepEqual(chargedAmounts, [2400]);
    await assert.rejects(checkout.pay(0), /Amount must be positive/);
    assert.deepEqual(chargedAmounts, [2400]); // Invalid input never reached the gateway.
  } finally {
    await testApp.close();
  }
}

try {
  await Promise.all([runCase(true), runCase(false)]);
  assert.equal(defaultGatewayCreations, 0);
  console.log('Approved and declined cases passed with separate state');
} finally {
  await fixture.close();
}
```

**What this buys you:** humans and agents can run deterministic behavioral tests
against the feature's public entry point. Both cases start with an attempt count
of zero, and overrides are checked against the module's external requirements.
No process-global service replacement or access to the private counter is needed.

**Boundary:** a fork creates fresh acquisitions, but a factory that closes over a
shared mutable object can still share that object. Create per-test data inside the
test or its factory, as above. Forks are independent owners: closing the fixture
does not close them. Contract checks do not prove a test's assertions are adequate
or that the fake matches a real payment provider's failure modes.

## 3. Let separate feature modules contribute tools to a shared dispatcher

An agent-assisted support application has knowledge-search and ticket-lookup
tools. Each feature can be developed and tested by a different contributor. The
host agrees on a tool contract and installs the selected modules; it does not
maintain a separate list of every tool instance.

```ts
import assert from 'node:assert/strict';
import { DiBag } from 'di-bag/node';

// contracts.ts: import this same token in every feature; do not recreate it.
type Tool = {
  name: string;
  description: string;
  run(input: string): Promise<string>;
};
const toolKey = Symbol('support tools');
const tools = DiBag.token(toolKey).of<Tool>();

const knowledgeModule = DiBag.createBuilder()
  .register({
    repository: () => new Map([
      ['refunds', 'Refunds are available within 30 days.'],
      ['shipping', 'Standard shipping takes 3–5 working days.'],
    ]),
  })
  .contribute(tools, ({ repository }: {
    repository: Map<string, string>;
  }): Tool => ({
    name: 'knowledge.lookup',
    description: 'Find a published support policy by topic.',
    async run(topic) {
      return repository.get(topic.toLowerCase()) ?? 'No published policy found.';
    },
  }))
  .buildModule([]);

const ticketsModule = DiBag.createBuilder()
  .register({
    repository: () => new Map([['T-42', { status: 'waiting-for-customer' }]]),
  })
  .contribute(tools, ({ repository }: {
    repository: Map<string, { status: string }>;
  }): Tool => ({
    name: 'ticket.status',
    description: 'Look up the status of a support ticket.',
    async run(ticketId) {
      return repository.get(ticketId)?.status ?? 'Ticket not found.';
    },
  }))
  .buildModule([]);

const app = DiBag.createBuilder()
  .installModule(knowledgeModule)
  .installModule(ticketsModule)
  .register({
    dispatch: DiBag.fromFunction([DiBag.all(tools)], (available) => {
      const byName = new Map(available.map(tool => [tool.name, tool]));
      if (byName.size !== available.length) throw new Error('Duplicate tool name');
      return async (name: string, input: string) => {
        const tool = byName.get(name);
        if (!tool) throw new Error(`Unknown tool: ${name}`);
        return tool.run(input);
      };
    }),
  })
  .build();

try {
  const dispatch = app.resolve('dispatch');
  assert.equal(await dispatch('knowledge.lookup', 'REFUNDS'),
    'Refunds are available within 30 days.');
  assert.equal(await dispatch('ticket.status', 'T-42'), 'waiting-for-customer');
  assert.equal(app.resolveAll(tools).length, 2);
  await assert.rejects(dispatch('ticket.delete', 'T-42'), /Unknown tool/);
  console.log('Two independently contributed tools are available');
} finally {
  await app.close();
}
```

**What this buys you:** exportless modules can contribute typed services while
keeping their helper registrations private. New features implement the shared
contract and contribute another tool; the dispatcher stays unchanged. A feature
test can install just one module and inspect its `resolveAll(tools)` result.

**Boundary:** the host explicitly selects modules at composition time. This is
not automatic plugin discovery, hot reloading, an LLM tool-calling protocol, or a
security boundary. Authentication, authorization, untrusted input validation, and
model-generated tool-call validation belong at the application boundary. The
dispatcher checks name uniqueness because the type contract cannot prove it.

## Where this approach fits

Use these patterns when independently owned features or tests would otherwise
depend on a large shared setup. They are less valuable when direct function calls
already express a small application's composition clearly. Other libraries also
support modular composition; see the [comparison guide](comparison.md).

DI Bag does not enforce repository ownership or prevent an agent from importing
another feature's source. Agree on contracts, keep feature implementation and
test files separate, and retain integration tests alongside isolated tests.
For the precise module API and its compiler limits, see the
[tutorial](tutorial.md#reuse-named-modules) and [compiler evidence](../benchmarks/typescript.md).

Return to [Why DI Bag?](../../README.md#why-di-bag).
