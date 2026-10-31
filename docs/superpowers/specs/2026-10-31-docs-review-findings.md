# Documentation review findings (2026-10-31)

Review goals, as set by the maintainer:

1. A strong and true hook at the start of the README for the human reader.
2. Gradual exposition of the capabilities for the human, where humans look
   first: README, website home and sidebar, tutorial, the "Why DI Bag?" guides.
3. Detailed API documentation with examples for coding agents and AIs:
   AGENTS.md, `docs/agent/*`, the JSDoc that generates the API card and the
   reference, and discoverability of those pages from outside the package.

Surfaces reviewed: `README.md`, `docs/README.md`, `AGENTS.md`,
`docs/agent/{api-card,recipes,errors}.md`, `docs/guides/*.md`,
`docs/reference/index/interfaces/*.md`, `tools/docs/vitepress.config.mjs`,
`tools/docs/site.mjs`, `tools/docs/lib/api-card.mjs`,
`tools/docs/api-card-tasks.json`, `package.json` `files`, `dist/*.d.ts`.

Each finding carries an impact score from 1/5 to 5/5. All twenty are to be
implemented; the plan is `docs/superpowers/plans/2026-10-31-docs-review-implementation.md`.

## Goal 1: a true hook

| # | Impact | Finding |
| --- | --- | --- |
| 1 | 5/5 | The README never shows the headline capability. It contains no compiler output and no `@ts-expect-error`; `examples-type-checking.md` has five. The hook should show the quickstart, then the exact `tsc` message after removing the `config` factory: `required services are missing: config`. |
| 2 | 4/5 | The subtitle asserts "built for coding agents" without proof. Three verifiable facts belong at the top: agent docs ship inside the npm package (`files` lists `AGENTS.md` and `docs/agent`), one module type-checks alone with its own `tsconfig.json`, and two modules can both own a private `store`. |
| 3 | 4/5 | The Install section front-loads the 0.4-to-0.5 codemod before any code. Move upgrade text to an "Upgrading" section at the end. |
| 4 | 3/5 | "Why DI Bag?" reads as a generic DI checklist. Keep the two differentiators, add "no decorators, zero runtime dependencies". |
| 5 | 3/5 | Badges sit under "Working on DI Bag". Move them under the title. |
| 6 | 2/5 | The website home has no hero; the footer tagline "Ordinary services. Checked composition. Explicit ownership." is a better opener than the first line. Add a VitePress home hero. |

## Goal 2: gradual exposition

| # | Impact | Finding |
| --- | --- | --- |
| 7 | 4/5 | The first module appears at README line 171 after four mechanics sections. Order: quickstart, compile error, a module in one screen, test replacement, ownership. |
| 8 | 4/5 | Sidebar "Start here" lists Comparison second and "Migrating to 0.5" fourth. Reorder: Introduction, Tutorial, Modules, Servers, React, Integration, Agent harnesses, Comparison; move Migrating under Reference. |
| 9 | 3/5 | The tutorial is one 1,516-line page where modules are step 4 at line 670. Move the modules section directly after disposal and renumber the learning path. |
| 10 | 3/5 | The modularity and type-checking guides open with long preambles before code. Lead with the layout or program, move the rationale after the first program. |
| 11 | 3/5 | The flagship concept has four names ("Modules as units of work", "Radical modularity", "Modules", "Reuse named modules"). Use "Modules as units of work" everywhere; keep "radical modularity" only as a defined term inside the guide and the comparison. |
| 12 | 2/5 | `examples/` has no index. Add `examples/README.md` with one line and a run command per example. |
| 13 | 2/5 | `## Child and independent containers {#child-and-independent-containers}` renders the braces literally on GitHub and npm. Remove the attribute. |
| 14 | 2/5 | The quickstart explanation covers immutability, graph checking, laziness, lifetimes, and ordering at once. Keep laziness and the type check. |

## Goal 3: API docs for agents

| # | Impact | Finding |
| --- | --- | --- |
| 15 | 5/5 | The API card says "every runtime call" but omits `module.withRenamedExport`, `module.moduleLabel`, `factoryContext.pushDisposer`, and `factoryContext.abortSignal`. Extend the generator's surface groups. |
| 16 | 4/5 | The "one way per task" table lacks: inspect without resolving, rename an export, replace a provider in a builder, alias, register a token service, adapt a class or function, own a resource acquired inside a factory, observe container closing. Add rows in `api-card-tasks.json`. |
| 17 | 4/5 | Card examples construct values but rarely read them; `moduleLabel` and `graphSnapshot().moduleInstallations` have no example in agent docs. Extend the `@example` blocks so each shows the read. |
| 18 | 3/5 | `dist/acquisition-context.d.ts` has no `@example`; `module.d.ts` has two; `di-bag.d.ts` has 32. Add examples to `FactoryContext`, `DisposerContext`, and `Module`. |
| 19 | 3/5 | `docs/agent/errors.md` links to `../guides/migrating-to-0.5.md`, which does not ship in the package. Link to the website and say in AGENTS.md what ships. |
| 20 | 3/5 | No `llms.txt` on the site and no agent pointer near the top of the README. Emit `llms.txt` and `llms-full.txt` from the site build; add one README line under the title. |

## Constraints that apply to every change

- `npm run docs:check` must pass: AGENTS.md at most 150 lines, API card within
  its budget, each recipe under 60 lines, every agent-doc snippet and every
  standalone README or guide program type-checks against the emitted
  declarations, the module layout block in AGENTS.md stays byte-identical to the
  one in `examples-modularity.md`.
- `npm run docs:retired-names` must pass on human-facing pages: no retired API
  names and none of the retired words (`bag`, `scope`, `fork`, `cleanup`,
  `startup`, `family`, `root lifetime`, `acquisition mode`) outside the allowed
  product names.
- Every claim in a hook must be verifiable from the repository or the package.
- Existing README anchors stay valid: `#why-di-bag`, `#install`, `#quickstart`,
  `#give-resources-a-clear-owner`, `#tradeoffs-and-limits`, `#runtime-support`,
  `#modules-as-units-of-work`, `#how-it-compares`. Tutorial anchors stay valid.
