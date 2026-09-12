# DI Bag and harness engineering: mechanism audit

Date: 2026-09-12. Audited HEAD: `7e47b6af7f5f9a662078a4c039d14f797ae1a51d`.
The working tree contained ongoing README, package-description, and guide edits;
this audit reads those drafts and changes no library code. It extends the
[prior positioning review](2026-09-11-agentic-positioning.md) with code evidence.

DI Bag provides a credible composition and ownership layer for a TypeScript
harness. Its strongest contribution is carrying private modules' requirements
through assembly and checked substitution while managing acquired resources.
It does not supply an agent execution graph, automatically extract a complete
dependency graph for tooling, or demonstrate better coding-agent performance.

## Claim ledger

“Demonstrated mechanism” means source and bounded checks establish behavior;
“Conditional architectural benefit” requires specific host design;
“Unmeasured performance hypothesis” needs comparative measurement;
“Unsupported” means the current API or evidence does not establish the claim.

| Claim | Evidence classification | Boundary |
| --- | --- | --- |
| Private/nested modules preserve host requirements | Demonstrated mechanism | Declared service and lifetime contracts, including private consumers |
| Modules reduce a coding agent's necessary context | Conditional architectural benefit | Task locality and context selection must follow those boundaries |
| DI Bag improves agent success, tokens, or completion time | Unmeasured performance hypothesis | No controlled agent experiment demonstrated here |
| Type checking rejects missing/incompatible wiring | Demonstrated mechanism | Supported typed API usage; not behavior or acyclicity |
| Forks provide independent acquisition ownership | Demonstrated mechanism | Captured objects, configuration callbacks, and external state can remain shared |
| Forks clone durable workflow state or deduplicate side effects | Unsupported | Neither checkpoints nor workflow execution identities exist in this API |
| Metadata enables a catalog before acquisition | Demonstrated mechanism | Host selects keys/collections and interprets metadata |
| Inspection exports actual dependency edges | Unsupported | Public snapshots contain no dependency-edge field |
| Observers provide complete node execution traces | Unsupported | Acquisition/lifecycle events omit ordinary service invocations |

## 1. Modules: what actually becomes local?

**Problem.** A retrieval feature needs a search client and a private normalizer.
The host should replace the client without accidentally binding another
feature's same-named normalizer; separately authored features must still compose.

**Mechanism.** `buildModule(exports)` seals registrations without acquiring them.
`moduleGraph` assigns fresh binding symbols at every installation depth, remaps
private references, and resolves names through the inner lexical scope, enclosing
module, then host. Export renaming preserves factory dependency names.
`ModuleConstraints` retains requirements from public *and private* providers;
`SealedConstraints` forwards unmet needs outward and discharges privately
satisfied ones. This is more substantial than hiding property names on an object.
[Module runtime](../../src/module.ts), [module types](../../src/module-types.ts).

**Host glue and consequence.** Authors must choose coherent contracts, put code
in navigable files, supply ambient requirements such as clients and clocks, and
write feature tests. The coding harness must locate and supply the contract,
implementation, relevant tests, and repository instructions. Only then might a
task require fewer files or tokens. A runtime harness separately chooses installed
features and exposes their tools; sealing itself does not curate an LLM prompt.
Measure files required for successful edits and composition errors caught, not
module count alone.

**Evidence.** The passing tests “names resolve lexically: inner scope, then the
enclosing module, then the host” and “three nesting levels forward unmet
requirements outward and keep replaced history private” exercise this behavior.
The negative fixture `module-hidden-private-needs.ts` rejects missing host needs
even for a module with no exports. `module-narrowing.ts` tests that annotations
cannot silently discard retained obligations.
[Nested tests](../../tests/nested-modules.test.ts),
[hidden needs](../../tests/types/negative/module-hidden-private-needs.ts),
[narrowing](../../tests/types/negative/module-narrowing.ts).

**Baseline/counterexample.** Ordinary ES modules with
`createRetrieval({ search }): Node` also hide helpers, accept typed fixtures, and
give an agent a focused assignment. DI Bag adds reusable composition machinery
and retained obligations; it does not uniquely create modularity. A feature
depending on a huge host interface still has a huge reasoning surface. Nor does
module privacy stop imports, global-variable access, network access, or filesystem
access: factories execute ordinary application code. It is not a sandbox.

## 2. Type checks: a useful but specific evaluation stage

**Problem → mechanism.** A coding agent changes an LLM adapter's return type or
omits a private tool's dependency. Type-level provider projections, missing/wrong
service constraints, module invariance, and replacement/lifetime checks can reject
that composition before acquisition. Promise-returning factories expose Promise
contracts explicitly. This catches faults at the assembly boundary even when
ordinary service call sites remain locally well typed.
[Provider types](../../src/provider.ts), [composition types](../../src/types.ts),
[replacement types](../../src/replacement-types.ts).

**Host glue → consequence.** The host runs the compiler on the real consuming
composition and interprets its diagnostics. Behavioral fixtures then test prompts,
routing, state updates, authorization, and failure handling. Catching a wiring
fault before starting clients can avoid that startup cost, but compiler startup,
inference, and diagnostic-reading time remain. A targeted manual-DI test may be
faster. Deterministic checks of an adapter returning the wrong type are not
measurements of answer quality, retrieval relevance, or autonomous task success.

**Limit/counterexample.** The audit probe constructs a fully typed numeric cycle:
`a` consumes `b`; `b` consumes `a`. Classic TypeScript reports **zero diagnostics**;
`resolve('a')` throws a cycle error. Building is lazy, and runtime acquisition
discovers actual dependency reads. Lazy references can delay discovery until
service use, including cycles among already-ready consumers. An unused factory
path need not execute at all. Types also cannot prove external response validity,
semantic compatibility of two strings, correct routing, or code bypassing
contracts with casts, unchecked JavaScript, or `any`.
[Acquisition](../../src/acquisition.ts),
[lazy-cycle test](../../tests/dependency-references.test.ts) (“lazy reads detect a
cycle between already ready consumers”). Thus “checked declared composition” is
defensible; “the graph is valid before execution” is too broad.

## 3. Forks, scopes, caching, and ownership

**Problem → mechanism.** Concurrent trials need fake clients and independent
per-trial resources. `fork` reuses immutable graph descriptions with optional
checked public replacements and constructs an independent bag. Child scopes
track ownership under a parent, share root-lifetime acquisitions, and create fresh
scoped acquisitions. Selected sharing retains the parent's already-bound
dependency context. `withDisposal` explicitly transfers cleanup responsibility;
merely returning an object with `close()` does not.
[Bag API](../../src/di-bag.ts), [runtime](../../src/runtime.ts),
[acquisition ownership](../../src/acquisition.ts).

**Host glue → consequence.** Allocate mutable trial logs/state inside each trial,
inject per-run identities, choose lifetimes, await node work, and close each fork.
This can centralize repeated fixture assembly and ensure owned resources are
released after dependents. Tests check independent ownership, parent closure of
descendants, dependency-ordered disposal despite asynchronous completion, and
continued cleanup after errors. Those are measurable lifecycle guarantees; less
host boilerplate or fewer production leaks remains application-dependent.
[Scopes](../../tests/scopes.test.ts), [disposal](../../tests/disposal.test.ts),
[enterprise fixtures](../../tests/enterprise-integration.test.ts).

**Counterexamples.** A factory `() => sharedConfig` returns the same object in
parent and fork: the probe confirms cross-fork mutation. Factories and observer
callbacks retain closure state; configured forks reuse the runtime configuration.
Reacquisition cannot clone an external database, environment variable, or
singleton SDK. A shared service retains its existing dependencies even when a
child replaces their public slots; the contribution test “shared aggregate borrows
the parent graph while a lazy registry reads its local graph” makes this concrete.
[Contribution tests](../../tests/contributions.test.ts).

Repeated default resolution of an async provider reuses its in-flight Promise.
This is acquisition caching, not idempotency: registering an action itself as an
async factory executes once per successful cached acquisition; the probe's fork
executes it again. Failed acquisitions can retry after partial external effects.
The host needs invocation IDs, transaction/idempotency policy, retries, persistent
state, and checkpoint semantics if the workflow requires them. A DI fork neither
snapshots a running node nor resumes a durable workflow branch.

Finally, `close()` drains tracked acquisition work and disposes resources; it does
not automatically track asynchronous calls on acquired functions. The probe
closes a bag while an invoked node still awaits a gate. Contextual factories can
receive an ownership cancellation signal, but the host must wire cancellation
and await application tasks. For a small graph, a factory function plus
`try/finally` is a simpler ownership baseline.

## 4. Metadata, observers, contributions, and the missing graph export

**Problem → mechanism.** A harness needs a tool catalog without opening every
connection. Static provider metadata is available through `inspect(key)` and
`inspectAll(token)` without acquisition. Dynamic metadata records acquisition-stage
facts, with explicit presence and ordered frames; cached reuse retains those
facts. Snapshot structures are frozen but nested application payloads retain
identity. Contributions append independently owned bindings in installation
order and expose a typed collection, including an empty collection.
[Inspection shapes](../../src/inspection.ts),
[metadata tests](../../tests/acquisition-metadata.test.ts),
[collection tests](../../tests/contributions.test.ts).

**Host glue → consequence.** Maintain selected public keys or a collection token;
define metadata semantics, tool input/output schemas, name uniqueness, validation,
authorization, catalog filtering, invocation adapters, and model-provider
registration. Static inspection can avoid expensive acquisition merely to display
a catalog. Dynamic metadata cannot supply acquisition facts before acquisition
and does not automatically update on every node call. The same result for a small
harness can come from a typed array of `{ description, schema, create }` records.
Collection order is not workflow order, and an empty collection is not a proof
that a required capability exists.

**Graph extraction finding.** Public `RegistrationSnapshot` contains binding ID,
label, optional alias target, registration metadata, and acquisition snapshots.
There is no general public enumerate-all-registrations or export-dependency-edges
method. `inspectAll` enumerates one known contribution collection. Internal
`GraphDescription` holds bindings and lexical lookup maps, not a complete
named-factory adjacency list. Types extract declared needs, but runtime named
factories receive a Proxy; dependency edges are recorded when properties are
read. The probe's provider declares `left` and `right` yet only reads `left`,
leaving `right` unacquired.
[Runtime graph](../../src/runtime.ts),
[Proxy acquisition](../../src/acquisition.ts),
[internal edge tracking](../../src/acquisition-family.ts).

Consequently, a tool cannot obtain complete actual dependency edges through
today's public inspection API. A source/type analyzer, additional explicit edge
declarations, or a new runtime export would be required. Extra declarations
introduce synchronization cost and can drift; runtime traces would still cover
only observed paths and distinguish acquisition attempts from registrations.
Alias-target inspection is a narrow exception, not general graph extraction.

**Instrumentation finding.** Observer events identify scopes, bindings,
acquisitions, metadata, and cleanup transitions; they contain no consumer-edge
field and no ordinary node invocation event. They run asynchronously and do not
gate cleanup; observer failures are reported separately. Two calls of the probe's
cached node generate zero additional lifecycle events. Temporal acquisition order
cannot reliably reconstruct dependency edges under concurrency or cache reuse.
The host must wrap node invocations for inputs, outputs, spans, token usage,
failures, and per-call evaluations, and manage telemetry flushing itself.
[Observer implementation](../../src/observers.ts),
[observer tests](../../tests/observers.test.ts).

## 5. “Radical modularity” is a granularity hypothesis

A coding harness and an application runtime harness benefit through different
causal chains. Coding: coherent boundary → locatable contracts and tests →
task-specific context selection → possibly fewer relevant tokens and mistakes.
Runtime: install selected capabilities → resolve dependencies with chosen
ownership → adapt capabilities to tools/nodes → execute explicit routing. Neither
chain follows merely from creating more modules or more graph nodes.

One-provider modules, excessive tokens, nested public projections, and repeated
renaming can increase navigation, integration edits, and diagnostic complexity.
Features crossing many tiny boundaries may require *more* context. Splitting one
logical operation across workflow nodes may also introduce state handoffs without
improving reasoning. Group around change cohesion, contracts, and ownership; do
not optimize module count.

Compiler cost is real: the repository's recorded 1,000-operation follow-up reports
classic stack overflows for one long named-registration/replacement expression,
while token modules pass. These are historical synthetic compiler observations,
not a new performance run or proof of an optimal module size.
[Compiler evidence](../benchmarks/typescript.md).

Existing frameworks are a serious baseline. Awilix already documents factory
injection, scoped/singleton/transient lifetimes, and explicit disposal; its
documented disposal does not recursively dispose child scopes. This gives one
concrete ownership difference to evaluate, not blanket superiority.
[Awilix primary documentation](https://github.com/jeffijoe/awilix#disposing).

## 6. Bounded verification and reproducibility

Commands ran from the repository root with `login:false`. Bun **1.4.2**
(`744846f84`), Node **v24.20.0**, actual classic compiler **6.0.3** from
`node -p "require('typescript').version"`; native `./node_modules/.bin/tsc --version`
reports **7.0.2**. The wrapper package manifest says **6.0.2**, which is not the
underlying classic compiler version. Native compiler tests were not rerun here.

```sh
git rev-parse HEAD
bun test tests/modules.test.ts tests/nested-modules.test.ts tests/scopes.test.ts tests/disposal.test.ts tests/providers.test.ts tests/observers.test.ts tests/contributions.test.ts tests/dependency-references.test.ts tests/enterprise-integration.test.ts
bun test tests/types.test.ts --test-name-pattern 'named modules|nested modules|type rejection: (module-hidden-private-needs|module-narrowing|nested-modules|module-private|module-missing|fork-wrong-shape|lifetimes|dependency-references)\.ts'
bun test tests/acquisition-metadata.test.ts
bun docs/research/di-bag-harness-probe.ts
```

Observed results: runtime subset **117 pass, 0 fail, 626 assertions** across nine
files (66 ms); compiler subset **10 pass, 0 fail, 109 filtered, 42 assertions**
(7.68 s); metadata **12 pass, 0 fail, 79 assertions** (23 ms). Durations are local
observations, not comparative performance evidence. The repository
[probe source](di-bag-harness-probe.ts) uses relative imports and resolves its
virtual compiler fixture from `import.meta.url`, independent of checkout location.

```json
{"cycleTypeDiagnostics":0,"cycleRejectedAtResolve":true,"nodeInvocations":2,"invocationEventsAdded":0,"inspectHasDependencyEdges":false,"forkSharesClosureObject":true,"actionEffectsAfterRepeatedResolveAndFork":2,"declaredButUnreadDependencyAcquisitions":0,"bagClosedBeforeNodeInvocationFinished":true}
```

## 7. Positioning changes and a falsifiable comparison

The current [harness guide](../guides/agent-harnesses-and-graphs.md) already
correctly separates dependency composition from workflow routing and includes
closure-sharing, cancellation, invocation-observer, and live-model-evaluation
limits. Preserve those qualifications. Its two deterministic paths establish an
example's routing and prompt construction, not improved agent performance.

Qualify the [README](../../README.md)'s “modularity is a practical
context-engineering technique” as “module boundaries can support task-specific
context selection.” Treat “quick evals” as “early composition checks and
deterministic behavioral tests,” with compiler cost acknowledged. Retract any
general dependency-graph extraction, automatic tool discovery, complete execution
tracing, sandboxing, durable-fork, or idempotent-workflow claim. None is supplied
by these mechanisms.

A useful benchmark should compare **well-structured manual DI**, **DI Bag**, and
an exactly pinned **Awilix** implementation of identical behavior. Give all three
the same ES-module boundaries, service contracts, schemas, documentation budget,
model/client fixtures, and externally scored tests. Include a small two-node
harness where manual DI may win and a larger plugin/resource-heavy harness where
composition machinery might pay for itself. Account for host glue needed to
achieve equivalent lifecycle semantics rather than assuming framework APIs match.

Pre-register 24 edits: add a tool, change an ambient client contract, swap a test
adapter, modify a private helper, alter routing, repair a lifetime leak, handle a
failed initialization, and coordinate cancellation, at multiple graph sizes.
Run paired randomized trials across at least two fixed model versions, with five
independent repetitions per task/variant/model and equal tool/time budgets.
Separate two experiments: automatic repository discovery, and controlled minimal
context. Otherwise better context packaging can be mistaken for a library effect.

Primary outcome: hidden-test task success. Secondary outcomes: tokens, completion
time, tool calls, unrelated edits, compiler latency/memory, diagnostic repair
turns, lifecycle violations, and host glue lines. Record failures/timeouts and
per-task paired confidence intervals; publish prompts, source snapshots, traces,
versions, and scoring rules. An advance claim such as “at least 15% fewer tokens
without lower success on resource-heavy tasks” is falsified by equivalent or
worse paired outcomes. Independently vary module granularity while holding
behavior constant. Measure actual runtime throughput/cleanup correctness in a
separate benchmark; do not infer agent improvement from microbenchmarks.

The stronger, narrower value proposition is: **DI Bag lets TypeScript harness
authors compose reusable private features, retain their declared host and
ownership obligations across assembly and test substitution, and inspect
application-defined capability metadata before acquisition.** Those mechanisms
can reduce repeated integration work when the harness has enough composition
complexity to justify them. Their effect on agent success, context cost, and
delivery speed remains measurable rather than assumed.

## Reproducible audit probe

Run `bun docs/research/di-bag-harness-probe.ts` from the repository root.
The [complete runnable source](di-bag-harness-probe.ts) contains assertions for
each observation above and creates its compiler fixture in memory; it writes no
files and makes no model or network calls.
