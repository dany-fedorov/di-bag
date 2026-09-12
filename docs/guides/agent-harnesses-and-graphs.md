# LLM harnesses and agent graphs

[Introduction](../../README.md) · [Modularity](examples-modularity.md) ·
[Contract checks](examples-type-checking.md) · [Metadata inspection](examples-extensibility.md)

DI Bag supports agentic development in two connected ways: small modules give
coding agents focused pieces of an application to work on, and those modules can
also supply the tools, context sources, and LLM clients inside an agent harness.
The application can be a conventional service, an agentic workflow, or both.

For the supporting reasoning, plain-TypeScript baselines, and unmeasured claims,
see the [detailed harness-engineering audit](../research/2026-09-12-harness-engineering-claim-audit.md).
It includes a real LangGraph comparison and explains why not every harness needs
a container or an execution graph.

## Where DI Bag fits

An **LLM harness** is the application layer around a model: it supplies context
and tools and controls how model and tool operations are used. An **agent graph**
represents the workflow as nodes, state, and routing edges. A node may call an
LLM, invoke a tool, or run ordinary deterministic code.

| Layer | What it describes | Who implements it? |
| --- | --- | --- |
| Dependency graph | Which factories supply a node's model client, tools, and other services; who owns acquired resources | DI Bag, using your registrations and ownership rules |
| Agent graph | Which operation runs next, what state it receives, and when to branch or loop | Your application or graph framework |
| Harness | How context, tools, execution limits, and results surround the LLM | Your application or agent framework, composed with DI Bag |

Resolving a service constructs its dependencies; it does not advance an agent
graph. An execution graph can loop without introducing a cycle in the dependency
graph: a node is a reusable function, not a fresh factory invocation on every
visit. DI Bag detects dependency cycles at runtime; it does not schedule workflow
edges or provide durable execution.

## Three building blocks for an agentic harness

- **Explicit feature boundaries.** Export a node or tool contract and keep
  its helpers private. A coding agent can implement that feature with focused
  repository context when contracts and tests capture the task's obligations.
  At runtime, the harness can use selected modules to supply
  a bounded tool set and explicit context sources to the LLM. DI Bag does not
  choose prompts or manage the model's context window.
- **Contract checks and fixture tests.** Check declared dependencies and replacement
  contracts before starting the harness. Then use forks with deterministic model
  and tool fixtures to test routing and state handling. These checks complement
  live-model quality evals; they do not establish answer quality or task success.
- **Inspectable capability descriptions.** Attach application-defined descriptions to
  providers, then inspect them without constructing services. Build catalogs,
  diagnostics, and dispatch rules around that data while keeping node functions
  independent of the tooling. Inspection describes selected registrations and
  acquisitions; it does not export a complete dependency-edge graph.

## A runnable harness with two graph nodes

This small support harness retrieves context and, when evidence exists, asks an
LLM-backed node for an answer. An empty retrieval takes the fallback edge without
calling the model. Each node is exported by its own module with a private helper;
the host supplies the search and LLM contracts and owns graph routing.

After [installing DI Bag](../../README.md#install), save the complete program below
as `harness.mts`. Install TypeScript 6.0.3 or newer and `@types/node`, then check,
compile, and run it:

```sh
npx tsc harness.mts --ignoreConfig --strict --skipLibCheck --types node --target ES2022 --module NodeNext --outDir out
node out/harness.mjs
```

Both adapters are deterministic fixtures: no model API, credentials, network, or
graph framework is needed. The uncalled `rejectedWiring` function includes two
deliberate type errors checked by `@ts-expect-error`; do not execute that function.

```ts
import assert from 'node:assert/strict';
import { DiBag } from 'di-bag/node';

type State = { question: string; context: readonly string[]; answer?: string };
type Node = (state: State) => Promise<State>;
type Search = { find(query: string): Promise<readonly string[]> };
type Llm = { complete(prompt: string): Promise<string> };

const retrievalModule = DiBag.createBuilder().register({
  normalize: () => (question: string) => question.trim().toLowerCase(),
  retrieve: DiBag.withMetadata(
    ({ search, normalize }: {
      search: Search;
      normalize: (question: string) => string;
    }): Node => async state => ({
      ...state,
      context: await search.find(normalize(state.question)),
    }),
    { static: { 'app:node': { kind: 'tool', description: 'Retrieve support context' } } },
  ),
}).buildModule(['retrieve']);

const answerModule = DiBag.createBuilder().register({
  formatPrompt: () => (state: State) =>
    `Question: ${state.question}\nContext: ${state.context.join('\n')}`,
  answer: DiBag.withMetadata(
    ({ llm, formatPrompt }: {
      llm: Llm;
      formatPrompt: (state: State) => string;
    }): Node => async state => ({
      ...state,
      answer: await llm.complete(formatPrompt(state)),
    }),
    { static: { 'app:node': { kind: 'llm', description: 'Answer using retrieved context' } } },
  ),
}).buildModule(['answer']);

const incomplete = DiBag.createBuilder()
  .installModule(retrievalModule)
  .installModule(answerModule)
  .register({
    search: (): Search => ({ find: async () => [] }),
    // Application code defines the agent graph's edges and per-call state.
    run: ({ retrieve, answer }: { retrieve: Node; answer: Node }) =>
      async (question: string): Promise<State> => {
        const state = await retrieve({ question, context: [] });
        return state.context.length > 0
          ? answer(state)
          : { ...state, answer: 'No evidence found.' };
      },
  });

const fixture = incomplete.register({
  llm: (): Llm => ({
    complete: async () => { throw new Error('Supply an LLM adapter for this run'); },
  }),
}).build();

function rejectedWiring() {
  // @ts-expect-error The answer module still requires an LLM client.
  incomplete.build();
  // @ts-expect-error An LLM replacement must return a string, not a number.
  fixture.fork(['llm'], { llm: () => ({ complete: async () => 42 }) });
}

try {
  // Explicitly select public nodes; private helpers stay inside their modules.
  const names = ['retrieve', 'answer'] as const;
  const catalog = names.map(name => ({
    name, ...fixture.inspect(name).registrationMetadata['app:node'],
  }));
  assert.deepEqual(catalog.map(node => node.kind), ['tool', 'llm']);
  for (const name of names) {
    assert.deepEqual(fixture.inspect(name).acquisitions, []);
  }

  // Evaluation harness: run both graph paths with fresh dependency instances.
  for (const hasEvidence of [true, false]) {
    const prompts: string[] = [];
    const trial = fixture.fork(['search', 'llm'], {
      search: (): Search => ({
        find: async query => {
          assert.equal(query, 'refund policy?');
          return hasEvidence ? ['Refunds are available within 30 days.'] : [];
        },
      }),
      llm: (): Llm => ({
        complete: async prompt => {
          prompts.push(prompt);
          return 'You have 30 days to request a refund.';
        },
      }),
    });

    try {
      const result = await trial.resolve('run')('Refund policy?');
      assert.equal(result.answer, hasEvidence
        ? 'You have 30 days to request a refund.'
        : 'No evidence found.');
      assert.deepEqual(prompts, hasEvidence
        ? ['Question: Refund policy?\nContext: Refunds are available within 30 days.']
        : []);
    } finally {
      await trial.close();
    }
  }
  console.log('Both agent graph paths passed; node metadata inspected without acquisition.');
} finally {
  await fixture.close();
}
```

The type checker verifies composition, including the two rejected wirings. The
runtime assertions verify metadata inspection, both routing paths, and the exact
context sent to the model fixture. The metadata catalog is ordinary application
data: DI Bag does not turn it into an LLM tool schema or register tools with a
model provider automatically.

Each fork owns fresh acquisitions and is closed separately. The prompt log is
created inside each trial; a factory closing over a shared mutable object would
still share that object. Graph state is created per `run` call, not kept in a
cached service. These fixtures test harness behavior, not real retrieval
relevance or LLM quality.

## Connect your own harness or graph framework

Keep the node contracts and replace the fixture adapters with your search and
model clients. Resolve the node functions and pass them to your graph framework,
or keep routing in an ordinary function as above. Modules can also
[contribute tools to a typed collection](examples-modularity.md)
when the harness needs a plugin-style tool set.

Use [provider metadata and inspection](examples-extensibility.md) to describe
capabilities before resolving them. Your harness must select what to expose,
validate untrusted inputs and model outputs, and enforce its own authorization
and execution limits. Metadata is descriptive, not a security boundary.

Use [scopes and forks](../../README.md#scopes-and-forks) according to the ownership
you need: scopes share root-lifetime services; forks have independent acquisitions
and cleanup. Register explicit disposers for owned clients. A harness must await
in-flight node work before closing its bag; closing a bag is not workflow
cancellation.

Routing, retries, checkpoints, and durable state remain with the harness or graph
runtime. DI Bag observers describe service acquisition and lifecycle events, not
every call to an already-acquired node. Instrument node invocations in your
application when you need execution traces or per-call eval data.
