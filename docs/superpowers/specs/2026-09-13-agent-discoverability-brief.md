# Agent discoverability brief

A starting point for a working session on one question: when a developer asks a
coding agent to build or change an application on DI Bag, what has to exist so
the agent succeeds without human help? This brief carries the facts from the
2026-09-13 assessment and the questions to settle. It is an agenda, not a task
list for an unattended run.

## How to use it

Open a new session in this repository and say: "Read
`docs/superpowers/specs/2026-09-13-agent-discoverability-brief.md`, then let's
think through its questions." Decide the questions first; draft files second.

## Facts an agent runs into today

- Documentation volume: 4,373 lines across `docs/guides`, plus 124 generated
  reference pages under `docs/reference`. Too much to load per task; nothing
  tells an agent which 200 lines matter for its task.
- No `AGENTS.md`, `CLAUDE.md`, or `llms.txt`. The `.agents/` and `.codex/`
  directories exist and are empty. The published package ships `dist/` only.
- The API is pre-1.0 and was renamed heavily in 0.1.0 with no compatibility
  aliases, so an agent's prior knowledge of the library is wrong. The negative
  fixture `tests/types/negative/api-renaming.ts` ensures old names fail to compile.
- The README is the best entry point. `docs/guides/agent-harnesses-and-graphs.md`
  contains one complete runnable program. `CONTEXT.md` is a glossary of terms.
- Two entry points: `di-bag/node` (Node and Bun) and portable `di-bag`, which
  throws `DI_BAG_CLASSIFIER_REQUIRED` at `build()` when a factory uses automatic
  acquisition. Agents will pick the wrong one.
- Compile-time rejections anchor at the start of the builder expression and
  collapse their details to `{ ...; }` unless `noErrorTruncation` is set. Plan 03
  (`docs/superpowers/plans/2026-09-13-03-legible-diagnostics-and-verify-graph.md`)
  puts the names into the message and adds `verifyGraph()`.
- The default lifetime is `scoped`: an unannotated client is re-created per
  child scope, and marking it `root` cascades because roots cannot capture
  scoped dependencies.
- A plain factory that returns a thenable (Knex, Drizzle, Mongoose query
  builders) fails only at first resolve today; plan 04 adds a compile-time check.
- The dependency object is a Proxy: `'x' in deps`, `Object.keys(deps)`, and
  `{ ...deps }` silently return nothing today; plan 02 makes them throw.
- The full test suite takes 8.5 minutes. An agent that runs `npm test` after
  every edit wastes most of its budget; plan 01 splits fast and compiler lanes.
- There is no way to list a bag's bindings or edges at runtime and no static
  graph export; plans 05 and 06 add `inspectGraph()` and the `di-bag-graph` tool.
- Async is viral: a `Promise<T>` service forces every consumer to declare and
  await it. Item 9 of the assessment (an unwrapped view of started services)
  is explained but not planned.

## Questions to settle in the session

1. Which agents and which files. Claude Code reads `CLAUDE.md` and skills;
   Codex reads `AGENTS.md`; Cursor reads `.cursor/rules`; several tools read
   `llms.txt`. Which of these should the repository ship, and which should the
   npm package ship? Shipping docs in the package changes the release contract
   checked by `scripts/verify-release-artifacts.ts`.
2. What success means. Proposal: an eval in which several agents, each seeing
   only the installed package, its shipped docs, and one module directory with
   its contract, implement their modules in parallel against a fixed
   application skeleton. Score whether the merged composition passes
   `npm run typecheck` and the module tests on the first attempt, and how many
   iterations each agent needs. A single-agent variant of the same tasks is
   the baseline.
3. Division of content. What belongs in `AGENTS.md` (rules and pointers), an
   API card (every public call, one line each, plus the compile-time messages
   and their fixes), and the tutorial. Size budgets: `AGENTS.md` at most 150
   lines; the API card at most 400 lines.
4. Drift control. How the new files stay correct: reuse the snippet checks in
   `tools/docs` or add a test that type-checks every code block in `AGENTS.md`.
5. The audit tasks. Walk each through the current docs and note where an agent
   stumbles: add a request-scoped service with cleanup; write a fixture test
   with `fork`; split a feature into a module with private services; debug a
   missing-dependency compile error; add an async client and consume it.
6. Positioning. The README frames DI Bag as the modular building block of
   codebases that agents build, with harnesses as one application. The claim
   that needs measuring is that sealed modules, fixture forks, and merge-time
   checks make parallel work on one codebase safer than plain modules and
   interfaces. The eval in question 2 is the proposed measurement. Discovery
   is served by the directory layout, not by the graph tools; do not sell the
   graph export as a planning input.

## Candidate deliverables

- `AGENTS.md` at the root: what the library is, the rules an agent must follow
  (entry point, lifetimes, thenables, dependency object, how to read a
  rejection), the recommended module layout from
  `docs/guides/examples-modularity.md`, how to run the fast checks, where the
  canonical docs are.
- `llms.txt` at the root following the specification at llmstxt.org.
- `docs/guides/agent-api-card.md`: every public call with a one-line purpose
  and a minimal example; a table of compile-time messages with the fix for each.
- A recipes section with copy-pasteable code for the five audit tasks.
- A snippet check for the new files.
- A proposal document under `docs/superpowers/specs/` with findings, open
  questions, and the eval design.

## Constraints for that session

- No changes under `src/` and no public API changes.
- Do not implement the plans under `docs/superpowers/plans/`; they are separate work.
- Keep the documentation style: terse, factual, no marketing language.
- Verify with `npm run typecheck`, `npm ci --prefix tools/docs`, and
  `npm run docs:check`. Do not run the full test suite.
- Deliver on a branch (`docs/agent-discoverability`) for review; do not merge.

## Sources to check first

Verify each before citing; these are starting points, not confirmed references.

- The AGENTS.md convention: https://agents.md
- The llms.txt specification: https://llmstxt.org
- Claude Code memory and skills documentation: https://docs.anthropic.com/en/docs/claude-code
- OpenAI Codex instructions files: https://developers.openai.com/codex
- Cursor rules: https://docs.cursor.com/context/rules

## Related

- Assessment decisions and the seven plans: `docs/superpowers/specs/2026-09-13-agentic-scale-hardening.md`.
- Earlier verdict on sas-box and val-box for harness use (optional adapters, not
  agent-specific): see the git history of `docs/research` before commit `ad14981`.
