# Agentic positioning fact-check

Date: 2026-09-11

## Bottom line

The proposed thought has a sound core but overstates what is known:

> Increasing modularity is a context engineering technique that improves
> agentic workflows. This dependency injection library helps agents work most
> effectively.

Selecting small, task-relevant context is established context-engineering
practice. Module boundaries can make that selection easier by providing a
smaller contract, implementation area, and test surface. That second step is a
design rationale, not a result these sources test. This repository provides no
evidence that DI Bag improves agent success, time, or cost, much less that it
makes agents work “most effectively.”

## Claim verdicts

| Claim | Verdict | Why |
| --- | --- | --- |
| Smaller, task-relevant context can help an agent | Supported | Anthropic recommends the smallest sufficient set of high-signal tokens and just-in-time retrieval. Long-context experiments also show that models do not use all positions robustly. |
| Increasing software modularity *is* context engineering | Too categorical | Context engineering curates information presented during inference. Modules may enable that curation, but a module boundary does not itself select or load context. |
| Explicit service boundaries can help agents work on focused units | Defensible as a design rationale | DI Bag can expose selected module exports, retain private registrations, check declared composition, and create checked replacements. Those affordances can bound an assignment and its wiring checks. The agent benefit is inferred, not measured. |
| DI Bag improves agentic workflows | Unproven as a general result | This repository has library correctness, compiler-scale, platform, and runtime benchmarks, but no controlled agent evaluation comparing DI Bag with manual DI or another container. Phrase as intent or possibility, not an outcome. |
| DI Bag helps agents work “most effectively” | Reject | “Most” implies comparative superiority. There is no agent benchmark, baseline, task suite, model matrix, or statistical result supporting it. |
| Type checking gives the fastest evaluation loop | Reject unless narrowly scoped and measured | A type check can catch declared wiring errors without starting an application, but it neither proves behavior nor guarantees lower wall-clock time than every targeted test. |

## What the primary sources establish

1. Anthropic defines context engineering as curating tokens available during
   inference. It recommends the smallest sufficient set of high-signal tokens,
   with just-in-time retrieval and progressive disclosure to focus an agent on
   relevant subsets. This supports focused context, not equating modularity with
   context engineering.

   Source: Anthropic Applied AI team, [Effective context engineering for AI
   agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents),
   2025-09-29 (definition, effective-context, and retrieval sections).

2. Anthropic reports success with simple, composable agent patterns, says
   decomposition can make calls easier, and recommends measuring rather than
   adding complexity without demonstrated benefit. This adjacent evidence does
   not evaluate source-code modules, dependency injection, or DI Bag.

   Source: Anthropic, [Building effective
   agents](https://www.anthropic.com/engineering/building-effective-agents),
   2024-12-19 (sections on prompt chaining, routing, combining patterns, and
   evaluation).

3. Liu et al. tested multi-document question answering and key-value retrieval.
   Performance could degrade when relevant information appeared in the middle
   of long contexts, including for long-context models. This shows that fitting
   more information does not guarantee robust use; it is not a study of coding
   agents or modular repositories.

   Source: Liu et al., [Lost in the Middle: How Language Models Use Long
   Contexts](https://aclanthology.org/2024.tacl-1.9/), TACL 2024,
   [DOI 10.1162/tacl_a_00638](https://doi.org/10.1162/tacl_a_00638).

## What the current library actually provides

- [`src/di-bag.ts`](../../src/di-bag.ts) implements ordinary factory
  registrations and an immutable builder; `build()` checks the declared graph
  at the TypeScript level and creates a lazy bag.
- `buildModule()` selects public exports while unselected registrations remain
  private; `installModule()` supports nested modules and retains host
  requirements. The runtime assigns fresh private binding identities in
  [`src/module.ts`](../../src/module.ts).
- `replace()` and `fork(keys, overrides)` provide checked substitutions, covered
  with modules in [`tests/enterprise-integration.test.ts`](../../tests/enterprise-integration.test.ts).
- [`src/provider.ts`](../../src/provider.ts),
  [`src/inspection.ts`](../../src/inspection.ts), and
  [`src/observers.ts`](../../src/observers.ts) implement metadata,
  non-resolving inspection, and lifecycle observers; see
  [`tests/providers.test.ts`](../../tests/providers.test.ts) and
  [`tests/observers.test.ts`](../../tests/observers.test.ts).

These facts justify “focused units,” “explicit contracts,” “checked
composition,” “test substitutions,” and “building blocks for custom tooling.”
They do not establish agent performance.

## Boundaries the README should preserve

- Modules are lexical composition boundaries, not filesystem permissions,
  process isolation, a security sandbox, or enforcement of code ownership.
- DI Bag does not choose, retrieve, compress, or manage an LLM’s context. A
  harness or developer decides what the agent receives.
- Type checks cover declared dependency compatibility and completeness. They do
  not prove business behavior, integration behavior, runtime inputs, or code
  that bypasses the types through casts, unchecked JavaScript, or `any`.
- Metadata, inspection, and observers are tooling primitives, not an autonomous
  agent framework or limitless reflection.
- Avoid “best,” “most effective,” “fastest,” or guaranteed productivity claims
  until a reproducible agent eval compares baselines across representative
  tasks, models, success rates, token use, latency, and cost.

## Recommended positioning

Describe the agentic benefit as a design aim, and modularity as a way to make
focused context practical—not as an automatic improvement or a measured result:

> DI Bag is designed to make modular applications easier for coding agents to
> work on. Modularity can be a practical context-engineering technique: clear
> feature boundaries can reduce the code and dependencies an agent needs to
> consider for a task. DI Bag is a TypeScript dependency injection library built
> around that idea—helping you define those boundaries, replace dependencies in
> tests, and check how the pieces fit together.
