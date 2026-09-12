# Harness engineering without borrowed credibility

Research date: 2026-09-12. Scope: DI Bag, Sas Box, Val Box, Application Exception, and Caught Object Report JSON (CORJ). This is a technical positioning audit, not a market forecast or an agent-performance benchmark.

## Conclusion

There is a defensible engineering thesis: **explicit module boundaries, checked composition, deliberate resource ownership, and inspectable data contracts can make a harness easier to change and verify.** These libraries implement different parts of that substrate. The inference that an LLM will consequently need less context, make fewer mistakes, or complete tasks faster remains conditional and unmeasured here.

DI Bag has the strongest architectural contribution: reusable private composition with retained host requirements, checked substitution, and acquisition ownership. Application Exception offers a substantive failure boundary: local typed kinds, bounded diagnostics, and separately selected public reports. CORJ addresses heterogeneous diagnostic representation and nested causes. Sas Box and Val Box are optional, narrower utilities; their common cases have credible small plain-TypeScript equivalents. Presenting all five as equally foundational to agent graphs would exaggerate the evidence.

The earlier common three-pillar framing was too uniform. Modularity, TypeScript, and metadata are not exclusive to these libraries, and the word “metadata” denotes different mechanisms in each. “For LLM harnesses and agentic development” is a supported application context, not evidence of an AI-specific capability or an experimentally established advantage.

## 1. Scope, method, and evidence strength

This audit inspected source, existing runtime/type tests, current README claims, and official framework documentation; added executable counterexample/baseline probes; and tested one real LangGraph integration against manual dependency injection. The detailed chapters retain source links, audited commits, test commands, counterexamples, and adoption experiments:

| Library | Detailed mechanism evidence | Practical adoption rationale |
| --- | --- | --- |
| DI Bag | [Composition, ownership, and inspection](2026-09-12-di-bag-harness-evidence.md) | [Harness guide](../guides/agent-harnesses-and-graphs.md) |
| Sas Box | [Provider contracts](2026-09-12-box-harness-evidence.md#chapter-1--sas-box-an-acquisition-mode-contract-with-narrow-incremental-value) | [Package rationale](https://github.com/dany-fedorov/sas-box/blob/main/HARNESS-ENGINEERING.md) |
| Val Box | [Presence and snapshots](2026-09-12-box-harness-evidence.md#chapter-2--val-box-independent-presence-channels-and-shallow-snapshots) | [Package rationale](https://github.com/dany-fedorov/val-box/blob/main/HARNESS-ENGINEERING.md) |
| Application Exception | [Kinds and reporting boundaries](2026-09-12-error-boundary-harness-evidence.md#chapter-1--application-exception-local-failure-kinds-and-a-deliberate-reporting-boundary) | [Published recovery guide](https://github.com/dany-fedorov/application-exception/blob/417308aaa144ddcc12ade8118e52b22c0e878918/docs/agent-recovery.md) |
| CORJ | [Caught-value and cause representation](2026-09-12-error-boundary-harness-evidence.md#chapter-2--corj-a-diagnostic-representation-of-caught-values-not-an-execution-graph) | [Package rationale](https://github.com/dany-fedorov/caught-object-report-json/blob/main/HARNESS-ENGINEERING.md) |

We distinguish four strengths of claim. A **demonstrated mechanism** has implementation and bounded test evidence. A **conditional architectural benefit** has a causal explanation but depends on application design. An **unmeasured outcome hypothesis** requires a comparison, such as improved agent success or cost. An **unsupported claim** asserts a mechanism the package does not provide. Passing tests do not move a claim from the third category into the first.

No model calls or coding-agent benchmark trials were run. No customer adoption, security certification, cross-framework compatibility matrix, or production durability was established. Existing compiler-scale measurements are historical evidence, not new runtime benchmarks. The probe dependencies were installed in a temporary directory; application dependency manifests and runtime implementations were not changed for this audit.

## 2. Three harnesses and several different graphs

In this report a **coding harness** is the environment in which a coding agent inspects a repository, edits files, invokes tools, and receives checks. A **runtime harness** surrounds an application's model calls with selected context, tools, policy, execution, and observations. An **evaluation harness** runs trials and graders against a fixed specification. One project can contain all three, but benefits do not automatically transfer between them. OpenAI's engineering account emphasizes repository legibility and enforced checks; Anthropic's evaluation account treats the model together with its execution environment as the system being evaluated. These are useful problem descriptions, not endorsements of these packages.[^1][^2]

| Graph | Meaning of an edge | What these libraries supply |
| --- | --- | --- |
| Source/module graph | An implementation imports or relies on another contract | All can be used in ordinary modules; DI Bag additionally composes sealed service modules |
| Service dependency graph | Acquiring one service requires another binding | DI Bag resolves and owns acquisitions; public inspection does **not** export complete dependency edges |
| Workflow or agent execution graph | State/control passes from one operation to another | Host code or a graph framework; none of the five schedules these edges |
| Error cause graph | One reported object refers to another through cause/aggregate relationships | Native errors retain causes; Application Exception reports them; CORJ can flatten object references |
| Provenance relationships | A result claims derivation from a source/revision | Caller-defined metadata can describe these; storage does not establish truth or lineage |

A dependency graph answers “what must exist for this node to run?” An execution graph answers “what happens next?” A cached node function may run many times along a workflow loop without reacquiring its dependencies. A bag fork may construct new services without copying any workflow state. A cause graph describes selected diagnostic relationships, not the history of operations that produced them.

An explicit execution graph is useful when routing, branching, repeated attempts, state updates, or interruption need to be visible and controlled. LangGraph's documented node/edge/state model is an example of that separate layer; it already offers typed state and runtime context for dependencies.[^3] A straightforward sequence of functions can be a better representation for a short linear task. A graph need not contain multiple agents, and a node need not call an LLM. Use deterministic operations where they satisfy the requirement; “agentic” does not imply that every decision should be delegated to a model.[^4]

## 3. Why modularity could help—and why “radical” needs a definition

Define radical modularity as making **cohesive, independently understandable and replaceable feature contracts the default**, not maximizing module count. The older information-hiding argument already says the criteria for decomposition matter more than the existence of modules; it does not offer evidence about LLM performance.[^5] The harness-specific inference is ours:

```text
cohesive feature boundary + explicit behavioral/ownership obligations
    → relevant contract, implementation, and tests can be located together
    → a coding task may omit unrelated implementation detail
    → compiler and behavioral checks expose some integration mistakes
    → potentially lower context cost or fewer repair cycles
```

Every arrow has a condition. A type such as `(query: string) => Promise<string>` says little about authorization, provenance, freshness, cancellation, cost, or failure semantics. Hiding those facts behind an interface does not remove the agent's need to know them. An undocumented shared transaction or global cache can make an apparently local edit unsafe. Good boundaries publish the obligations that consumers must preserve and hide implementation choices that consumers need not reason about.

For example, changing retrieval normalization can be local if the contract specifies ordering, duplicate handling, source identity, and absence/error distinctions, and tests cover the relevant invariants. Changing tenant authorization is not local merely because the authorization helper lives in a small module: tool exposure, retrieval filtering, cached results, logging, and downstream consumers may all participate. Context selection must follow the change's actual impact, not its folder name.

At runtime there is a different chain: the host selects capabilities, adapts them into tool definitions/context sources, and supplies an appropriate subset to the model. Smaller, distinguishable interfaces can help this selection. Anthropic's context-engineering guidance supports deliberate selection and clear tool interfaces, but does not establish that DI containers or any particular module size improve outcomes.[^6] Installing fewer DI modules does not by itself remove tool descriptions from a prompt; the host must actually perform that projection.

Excessive decomposition adds navigation, naming, wiring, type inference, state handoffs, and cross-boundary coordination. A one-line helper does not necessarily deserve a provider, and one coherent operation does not necessarily deserve several graph nodes. A useful architecture can retain private helpers inside a feature, use a modest public capability surface, and keep a plain function for a simple workflow. Parallel development also needs integration checks for shared invariants; private names do not make independently generated changes semantically compatible.

The public evidence about repository instructions cautions against assuming that more architectural prose automatically helps. Gloaguen et al.'s June 2026 revision reports that context files did not generally improve task success and increased cost in its evaluated settings. Lulla et al.'s March revision reports lower runtime and output tokens in a different study, but does not comprehensively establish correctness and does not show a reduction in median total tokens. Different tasks, treatments, and measures prevent a single universal conclusion. Neither study tests these libraries or source-module granularity.[^7][^8] Our detailed rationale should therefore remain discoverable reference material, not mandatory prompt content for every edit.

## 4. The three selling points, made operational

### Modularity: a boundary mechanism, not an agent outcome

DI Bag contributes private binding remapping and retained requirements across nested module installation. Sas Box contributes an acquisition interface. Val Box contributes a presence-aware handoff representation. Application Exception separates local failure identity from report audiences. CORJ gives several catch boundaries a common diagnostic format. These are different ways to reduce coupling; only DI Bag supplies a module-composition system.

The incremental claim must name work that disappears or an invariant that becomes enforceable. “Private providers cannot silently lose their declared host requirements during composition” is specific and testable. “Agents understand the code better” needs measured successful edits. Plain ES modules, dependency parameters, discriminated unions, and explicit records already provide substantial modularity. They are the baseline, not the absence of architecture.

### TypeScript: one inexpensive-to-repeat check, not a substitute for evals

There are three distinct feedback loops:

1. **Static contract checks:** missing services, incompatible replacement types, async-only providers passed to sync consumers, unchecked presence, incorrectly shaped local report consumers.
2. **Deterministic behavioral checks:** fixture outputs, routing, retry budgets, no-model fallback paths, resource cleanup, disclosure selection, serialization loss, and schema decoding.
3. **Model/application evaluations:** task completion, answer quality, retrieval usefulness, recovery success, adversarial behavior, and cost across repeated actual model runs.

TypeScript serves the first loop; the libraries can make seams useful for the second. Neither proves the third. The compiler also cannot prove the semantic meaning of an arbitrary string, remote JSON validity, safe retries, or absence of all dependency cycles. The DI probe contains a fully typed cycle that fails at acquisition, not compilation. Large type-level compositions have compiler costs, and the existing [compiler evidence](../benchmarks/typescript.md) records limits. “Quick evals” should mean early contract checks and deterministic fixtures that avoid external startup when appropriate—not a latency claim or an LLM quality result.

### Metadata: the beginning of a protocol, not an automatic policy engine

For metadata to make a harness programmable, a producer must define what each field means, a consumer must implement a real action, and the boundary must specify validation, ownership, trust, versioning, and drift handling. A `{ risk: 'read-only' }` label cannot make a tool read-only. A `{ fresh: true }` field cannot prove freshness. A schema checks shape, not the authority or accuracy of the claim.

DI Bag can expose registration metadata before acquisition and acquisition metadata afterward; the host can build a selected catalog. Sas Box exposes an alias and acquisition-mode capability, not a general metadata store. Val Box carries independently optional application metadata alongside presence. Application Exception supplies kind/occurrence/report fields with audience-specific projection. CORJ supplies representation/version metadata and causal object links; run and invocation identity remain outside it. One generic “metadata-driven graph” slogan erases these important distinctions.

DI Bag's missing dependency-edge export is particularly relevant to the original intuition. Today, metadata can drive tooling over **selected public registrations or contribution collections**, but public inspection cannot supply a complete adjacency graph. Runtime named factories discover reads through a proxy; declared-but-unread dependencies need not be acquired. A future source analyzer or explicit graph manifest would be additional engineering, with its own completeness and synchronization rules—not a capability we can advertise now.

## 5. Where each package earns its place

### DI Bag: composition and ownership, with the strongest architectural case

The concrete chain is separately authored features → sealed private providers and retained host contracts → checked installation/replacement → independently owned acquisitions and cleanup. A plugin-rich harness with shared clients, private helpers, trial fixtures, and request-scoped resources repeatedly faces these problems. Keeping that machinery out of node functions is a real design benefit when manual assembly becomes repetitive.

The host still defines tool schemas, routing, invocation tracing, cancellation, authorization, and workflow state. Observers record acquisition/lifecycle activity, not every call on an acquired node. Forks have fresh acquisition ownership but may share objects captured by factories; they do not isolate filesystems, databases, prompts, or all mutable state. `close()` does not await arbitrary in-flight calls on acquired services. A host must finish/cancel and await application work before disposing resources. A small graph using factories and `try/finally` may be simpler and equally correct. [Full evidence](2026-09-12-di-bag-harness-evidence.md).

### Sas Box: a reusable sync/async acquisition boundary, not a graph foundation

The concrete chain is a consumer requiring a known payload and acquisition mode → a checked provider contract → substitution of a value, synchronous loader, or asynchronous loader → the same consumer exercised with fixtures. This is useful when multiple producers genuinely expose different acquisition modes and some consumers require a synchronous route.

If every node is already asynchronous, `() => Promise<T>` often suffices. Sas Box does not cache, deduplicate concurrent calls, manage lifetimes, accept per-call arguments, or provide a general metadata API. Calling `.async()` on a sync-backed box still executes the callback synchronously before promise continuation; it does not move work off-thread. A `Sync<Promise<T>>` synchronously acquires a promise, not an immediate `T`. Independent sync and async callbacks can return different values. The strong claim is a maintained acquisition vocabulary; lower agent context cost remains a hypothesis. [Full evidence and plain-provider comparison](2026-09-12-box-harness-evidence.md).

### Val Box: precise absence and separate metadata, when those distinctions matter

The concrete chain is a host needing to distinguish missing output/configuration from supplied `undefined`, `0`, or `false` → independent presence flags → discriminated snapshot consumers → explicit fallback or handoff behavior. A second channel can explain absence without inventing a value. Mutable construction and checked conversion help repeated adapter workflows that gather these channels incrementally.

A plain presence union or `{ value, metadata }` record may be enough. Val Box adds no verified provenance, `map` operation, scheduler, general result algebra, or checkpoint codec. Presence does not mean success: an Error can be present, and a metadata-only box can denote several entirely different application states. Snapshots freeze channel records but retain nested mutable references. JSON drops a supplied-undefined payload property while retaining its presence flag; a wire protocol must define decoding. Use an explicit execution-state union when the actual problem is `pending | success | failure | cancelled`. [Full evidence and union comparison](2026-09-12-box-harness-evidence.md).

### Application Exception: failure semantics and deliberate disclosure

The concrete chain is distinguishable local failures → typed constructors/native causes and occurrence identity → bounded operational diagnostics → explicitly selected public codes/details → deterministic host policy. The separation is substantive: `toPublicReport` accepts a reference and chosen presentation, not an error object. This makes accidental traversal of diagnostics at that call boundary less likely; it does not make caller-selected secrets safe.

Details types are not runtime field decoders, nested details are not deeply immutable, and local class guards are not remote authentication. Retry policy, idempotency, permission, and persistence remain host responsibilities. Native Error/cause, a tagged union or subclass, and a careful projection are serious alternatives. The package earns its cost when many boundaries need consistent construction, normalization, correlation, and decoding. [Full evidence](2026-09-12-error-boundary-harness-evidence.md).

### CORJ: diagnostic normalization and cause structure

The concrete chain is heterogeneous SDK throws → one inspectable JSON representation → bounded compact output with nested-cause references → consistent logging and fixture assertions. This is valuable when minimal custom serializers repeatedly lose required facts or mishandle cycles/aggregate failures. Cause IDs and paths describe the report's objects; they are not agent-run IDs or an execution trace.

The host selects destinations, public fields, retry semantics, and final prompt budgets. CORJ can invoke getters, string conversion, and custom hooks; catching inspection exceptions is not CPU/memory isolation. Its output cap measures the report, not a wrapper or tokens, and truncation may discard useful facts or metadata. Raw stacks and enumerable fields can expose secrets. Application Exception already has its own diagnostic producer, so stacking both formats is often unnecessary. In the combined probe, CORJ exposed `details.token` that Application Exception's diagnostic producer redacted. This is a concrete adapter-policy mismatch, not an automatic safe integration. [Full evidence](2026-09-12-error-boundary-harness-evidence.md).

## 6. A real framework probe—and the equally capable baseline

The [executable integration probe](harness-engineering-probe.mts) compiles and runs against LangGraph `1.4.15`, Zod `4.6.2`, and the audited local DI Bag/Application Exception builds. A `respond` node has conditional retry routing, typed fixture failures, selected public codes, bounded diagnostic records, and in-memory checkpoints. Four scenarios compare DI Bag assembly with manual assembly of the **same node and client factories**:

| Scenario | Client calls | Final outcome | Comparison |
| --- | ---: | --- | --- |
| Immediate success | 1 | done | Same graph state and one cleanup |
| One known failure, then success | 2 | done | Same graph state and one cleanup |
| Known failures exhaust two attempts | 2 | fallback | Same graph state and one cleanup |
| Unexpected failure | 1 | fallback with generic code | Same graph state and one cleanup |

All assertions passed on Node `v24.20.0` with classic TypeScript `6.0.3`. Each DI fork created one client, reused its acquired node, and disposed the client after awaited graph execution. The manual branch used direct injection and `try/finally` and achieved identical results. This establishes compatibility over these cases and demonstrates a fair baseline; it does not establish that DI Bag improved the workflow or that the graph required DI.

Only data enters checkpoints. Clients, bags, provider functions, exception instances, and mutable box objects remain outside saved state. The probe checks checkpoint values and their JSON round-trip, not crash recovery, distributed exactly-once work, concurrency correctness, cancellation, or production persistence. `MemorySaver` loses its checkpoints on process restart.[^9] The fixture has no externally mutating action, so its two-attempt policy must not be generalized to payments or other side effects; real LLM retries can also incur cost.

The probe intentionally does not import all five packages. There is no requirement for dual-mode acquisition, independent presence channels, or a second diagnostic format in this example. Forcing those abstractions in would demonstrate syntax, not necessity. Their separate comparative probes establish their narrower mechanisms without inventing an architectural dependency between them.

### Reproducing the framework comparison

Use sibling `di-bag` and `application-exception` checkouts at the commits recorded in the detailed chapters, with locked development dependencies installed. Build both packages first (`npm run build` in each). From the DI Bag root, the following stages a disposable consumer; it does not change application dependencies. The dependency lock is part of this research artifact. Commands assume a POSIX shell and the audited Node version.

```sh
audit_root="$PWD"
probe_dir=$(mktemp -d /tmp/harness-comparison.XXXXXX)
cp docs/research/harness-probe-deps/package.json "$probe_dir/package.json"
cp docs/research/harness-probe-deps/package-lock.json "$probe_dir/package-lock.json"
npm ci --prefix "$probe_dir" --ignore-scripts --no-audit --no-fund
cp docs/research/harness-engineering-probe.mts "$probe_dir/probe.mts"
ln -s "$audit_root" "$probe_dir/node_modules/di-bag"
mkdir -p "$probe_dir/node_modules/@types"
ln -s "$audit_root/node_modules/@types/node" "$probe_dir/node_modules/@types/node"
mkdir "$probe_dir/node_modules/application-exception"
cp -R "$audit_root/../application-exception/dist/." "$probe_dir/node_modules/application-exception/"
cp "$audit_root/../application-exception/package.json" "$probe_dir/node_modules/application-exception/"
ln -s "$audit_root/../application-exception/node_modules" "$probe_dir/node_modules/application-exception/node_modules"
(
  cd "$probe_dir"
  node "$audit_root/node_modules/@typescript/old/bin/tsc" probe.mts --ignoreConfig --strict --skipLibCheck --types node --target ES2022 --module NodeNext --outDir out
  node out/probe.mjs
)
```

Application Exception is staged using its published layout: compiled files plus its manifest. Pointing an ESM consumer at the checkout's bare `dist` directory without a manifest is not equivalent to an installed package. During development, the initial graph also reused `answer` for both a state field and a node; compilation accepted it but LangGraph rejected the conflict at graph construction. Renaming the node to `respond` fixed the probe. This is another concrete reason to run behavioral/framework checks after TypeScript.

### Other bounded verification

The chapter audits ran 117 selected DI runtime tests, 10 selected classic compiler tests, and 12 acquisition-metadata tests; 13 Sas Box and 19 Val Box runtime tests plus their type checks; 173 Application Exception tests plus type checks; and 1,054 CORJ tests with 25 snapshots. These counts describe different selected suites, not a common quality metric. The [DI probe](di-bag-harness-probe.ts), [box runtime probe](box-harness-probe.ts), [eight-negative type probe](box-harness-types.ts), and [error-boundary probe](error-boundary-harness-probe.ts) are durable sources with reproduction instructions in their chapters. Historical suite durations are observations, not comparative speed claims.

The final verification reran all three standalone runtime probes and the eight-negative type probe successfully, then repeated the framework comparison from a fresh temporary consumer using the retained dependency lock (`npm ci`, using the local cache). DI Bag's 12 documentation checks passed; its site build verified 122 rendered pages and 15,223 internal links, anchors, and assets. CORJ's regenerated TypeDoc output passed a check of 41 HTML pages and 713 local page/anchor/asset links, with three pre-existing warnings about referenced internal types not included in its API documentation. A separate pass found all 276 local or locally mapped repository link targets across 15 Markdown documents. These checks do not claim that the new GitHub publication URLs were already published.

A read-only adversarial review found no important unsupported claims in its targeted source and research-attribution checks. Its two minor findings—cross-repository relative links and stale statements about which documentation had changed—were corrected. Review is a second inspection, not independent experimental validation. Runtime implementations remain unchanged; documentation, research probes, and the isolated probe dependency lock are the deliverables.

### Verification of the mechanism-first value statements

The subsequent publication pass targets DI Bag, Sas Box, Val Box, and CORJ. README headings and package descriptions lead with their concrete contracts; the LLM, harness, graph, and agentic keywords remain application contexts. Application Exception's separate README/rationale draft is outside this publication pass, so the table above links its existing pinned recovery guide instead.

Full pre-commit checks passed: DI Bag's type check and **967 tests**, Sas Box's type check/build and **17 tests**, Val Box's type check/build and **23 tests**, and CORJ's TypeScript check and **1,054 tests with 25 snapshots**. DI Bag's first full run had 885 passing tests and one failed package setup because npm printed an update notice to stderr, which that setup requires to be empty. A fresh full run with `npm_config_update_notifier=false npm test` passed all 967 tests; no assertions or runtime code were changed. These are verification results, not speed or agent-quality measurements.

The final documentation checks/build passed, the retained runtime/type probes and four-scenario LangGraph comparison passed again, and CORJ's deterministic harness example passed after regenerating its HTML. A Markdown check covered 303 local or locally mapped link targets and anchors across the 13 documents in this publication scope. A second read-only review found no issues in the revised value statements, heading links, or publication dependencies. CORJ's documentation commit uses the repository's existing `[skip ci]` convention to avoid invoking its push-triggered release workflow; local validation was performed explicitly, and no release tags are part of the requested pushes.

## 7. What would actually establish the stronger value proposition?

Separate **architecture value** from **library value**. First compare an existing architecture with a carefully modularized version using ordinary TypeScript. Then compare that modular baseline with the library-assisted version while preserving feature boundaries, behavior, tests, and documentation access. Comparing a polished library example to a monolith full of global state cannot identify which change caused an improvement.

For an initial study, define approximately 24 realistic change tasks spanning adapter replacement, private-helper edits, dependency-contract changes, new tools, presence/fallback bugs, disclosure mistakes, lifecycle leaks, cancellation, and cross-node invariants. Include a small harness where direct injection may win and a larger resource/plugin-heavy harness where composition machinery has more opportunity to help. This is a pilot size, not a statistically justified universal sample size; use observed variation to design a confirmatory study.

Fix and publish source/dependency/model versions, tasks, prompts, tool/time budgets, hidden tests, graders, and failure criteria before comparison. Randomize condition order and repeat trials; score the same externally visible behavior. Run one arm with normal repository discovery and another with carefully selected equivalent context. Hold documentation quality and allowed facts comparable so a better README is not mistaken for a better library. Blind human review to the condition where practical, and report failures and timeouts rather than only completed runs.

Primary outcome should be accepted task success under independent checks, including security-relevant and cross-feature invariants. Secondary measures can include cost per accepted change, actual input/output tokens, elapsed time, repair cycles, unrelated edits, compiler time/memory, cleanup violations, and necessary integration code. Keep runtime serializer benchmarks separate from coding-agent studies. Control trial state and machine resource limits; infrastructure variation itself can change agent benchmark outcomes.[^10] Do not count lower output tokens alone as lower overall cost or equivalent correctness.

Each package needs a narrower component experiment too. DI Bag must earn its assembly/ownership complexity against manual DI and an existing container. Sas Box must earn an acquisition abstraction against a structural provider and an all-async function. Val Box must earn its builder/conversion API against a presence union and the application's existing result type. Application Exception must improve required failure handling/disclosure consistency against native causes and explicit projection. CORJ must preserve required diagnostic facts under a fixed budget more reliably than a purposeful serializer or existing logger. The detailed chapters specify failure corpora and falsifying outcomes.

An honest success claim would report the exact task population, conditions, effect size, uncertainty, and regressions. A negative result would narrow positioning rather than invalidate every mechanism. For example, equal agent success with greater integration complexity would reject an agent-productivity claim for that workload while leaving bounded diagnostics or checked composition useful on their own merits.

## 8. Documentation decisions and adoption rule

Keep the keywords upfront, but lead immediately into a precise operation. Prefer “compose and own a harness's dependencies,” “declare sync/async acquisition requirements,” “preserve supplied-versus-absent values,” “select a public failure report,” and “bound diagnostic JSON with nested causes.” Describe who supplies routing, context selection, metadata policy, schemas, persistence, and invocation tracing. Link to the evidence instead of requiring every introductory reader to ingest this report.

Do not advertise complete graph extraction, sandboxed modules, deep immutable provenance, automatic safe recovery, durable forks, bounded hostile-code execution, or measured LLM gains. Those claims lack the necessary mechanisms or experiments. Possible future adapters, graph exports, codecs, tracing wrappers, and eval datasets are separate work, not current features.

The practical adoption rule is: **identify a repeated boundary problem, show which package mechanism enforces the needed contract, compare it with the simplest equally capable baseline, and keep it only if that contract justifies the added concepts.** The architecture thesis is stronger than “all five libraries belong in every agent graph.” Its credibility depends on making that distinction explicit.

## Sources and limits of attribution

Package-specific implementation claims are sourced in the three linked evidence chapters to audited source revisions and local tests. External sources below establish terminology, architecture arguments, existing framework mechanisms, or related empirical findings; none evaluates these five libraries. All were consulted on 2026-09-12. Research-paper revisions matter: findings here refer to the linked v2 texts, not earlier summaries. Vendor engineering reports are contextual primary accounts, not controlled evidence of our proposed causal effect.

[^1]: Ryan Lopopolo, OpenAI, [Harness engineering: leveraging Codex in an agent-first world](https://openai.com/index/harness-engineering/), 2026-02-11. Engineering experience report; supports the importance of repository legibility and enforceable feedback, not library-specific performance claims.
[^2]: Anthropic, [Demystifying evals for AI agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents), 2026-01-09. Evaluation definitions, host/model interaction, and trial-design guidance.
[^3]: LangChain, [LangGraph JavaScript Graph API overview](https://docs.langchain.com/oss/javascript/langgraph/graph-api), current documentation. Node/state/edge and runtime-context mechanisms; executable probe pinned separately to version 1.4.15.
[^4]: Anthropic, [Building effective agents](https://www.anthropic.com/engineering/building-effective-agents), originally 2024-12-19, live page subsequently updated. Conceptual distinction between predefined workflows and model-directed operation, and the value of starting with simpler patterns; not a frozen survey of today's framework market.
[^5]: D. L. Parnas, [On the criteria to be used in decomposing systems into modules](https://prl.khoury.northeastern.edu/img/p-tr-1971.pdf), CMU-CS-71-101, August 1971. Original technical report, distinct from the later journal publication. Information-hiding/decomposition argument, not an LLM experiment.
[^6]: Anthropic, [Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents), 2025-09-29. Context selection and tool-interface guidance; does not test DI Bag or source granularity.
[^7]: Gloaguen et al., [Evaluating AGENTS.md: Are Repository-Level Context Files Helpful for Coding Agents?](https://arxiv.org/html/2602.11988v2), v2, 2026-06-23. CTXbench contains 138 tasks from 12 Python repositories; the study also uses SWE-bench settings. Its intervention is repository context files, not these libraries or module decomposition.
[^8]: Lulla et al., [On the Impact of AGENTS.md Files on the Efficiency of AI Coding Agents](https://arxiv.org/html/2601.20404v2), v2, 2026-03-30. Study of 124 tasks from 10 repositories. Efficiency findings have narrower correctness and generalization support than a claim of improved successful development.
[^9]: LangChain, [LangGraph JavaScript persistence](https://docs.langchain.com/oss/javascript/langgraph/persistence), current documentation. Separates thread checkpoints from stores and explicitly limits in-memory checkpoint persistence.
[^10]: Gian Segato, Anthropic, [Quantifying infrastructure noise in agentic coding evals](https://www.anthropic.com/engineering/infrastructure-noise), 2026-02-05. Resource-environment effects on benchmark outcomes; rationale for controlled conditions, not a result about this library portfolio.
