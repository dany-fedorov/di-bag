# Documentation suite implementation plan

> **For agentic workers:** Execute these tasks in order; independently review the completed documentation and tooling before publishing.

**Goal:** Deliver a readable README introduction, a comprehensive tutorial, and a precise generated API reference, all available as Markdown and through a searchable GitHub Pages site.

**Architecture:** Handwritten Markdown owns explanations and examples. TypeDoc with its Markdown plugin owns exact declarations and overloads. VitePress builds a selected documentation tree for the `/di-bag/` project site. Documentation tools have an independent lockfile under `tools/docs` and never become runtime dependencies.

**Tech stack:** Node 24, TypeScript 6.0.3, TypeDoc 0.28.20, typedoc-plugin-markdown 4.13.0, VitePress 1.6.4; use the compatible VitePress TypeDoc theme if its output remains readable in GitHub Markdown.

## Requirements

- Keep README short enough to serve as an introduction; provide installation and a working first example.
- Separate the learning guide from exact API declarations. Cover all facade, builder, module, bag, adapter, and error APIs, plus every public type export.
- Preserve Node HTTP, Express, Fastify, Bun, and Deno recipes and their ownership/cancellation guidance.
- Commit generated Markdown. Derive it from public entry points, include overloads, type parameters, parameters, return values, and source links; never advertise type-only classes as runtime constructors.
- Generation is deterministic and stale-output checking detects added, changed, and removed pages.
- Build the same Markdown into a responsive site with local search, navigation, code highlighting, source/edit links, and a correct GitHub Pages project base.
- Validate builds on pull requests; deploy the verified main-branch artifact using GitHub Actions Pages permissions. Do not put build output or documentation-tool dependencies in the published npm archive.

## Tasks and acceptance evidence

### 1. Research and choose the tooling

- [x] Save primary-source comparison and compatibility findings in `docs/research/2026-09-09-documentation-tooling.md`.
- [x] Lock the chosen packages in `tools/docs/package.json` and `tools/docs/package-lock.json`.
- [x] Generate a first API tree from `src/index.ts`, `src/node.ts`, `src/sas-box.ts`, and `src/val-box.ts`; inspect real generic/overloaded output before designing the reference navigation.

### 2. Separate and improve the Markdown documents

- [x] Create `docs/guides/tutorial.md` from the existing explanatory material, ordered from first composition through async/ownership/scopes to modules, tokens, adapters, collections, observers, and plugins.
- [x] Make `docs/guides/api-reference.md` the human index into the generated reference, preserving API/error/type inventories and linking the detailed tutorial.
- [x] Update README and all active guide links. Preserve moved-anchor access from the reference index where practical.
- [x] Add useful API comments and examples to public declarations without changing runtime behavior. Explain type-only entry-point exports and private implementation constraints in the generated view.

### 3. Automate generation and site building

- [x] Add documentation commands for generation, drift checking, local development, build, and preview.
- [x] Test the tooling's meaningful contracts: Markdown link rewriting, generated-tree drift detection, public API coverage, and exclusion of runtime-only source constructors/private fields from the public reference.
- [x] Build a staged site from selected Markdown files; preserve GitHub-readable links in the originals and link non-site repository files back to GitHub.
- [x] Configure VitePress navigation, local search, light/dark styling, and `/di-bag/` base. Inspect a desktop page, narrow viewport, and actual search results.
- [x] Document how maintainers edit prose, update signatures, regenerate Markdown, and publish the site.

### 4. Verify and publish

- [x] Run source typecheck/build and focused documentation/integration checks; compile/run documented examples where changed.
- [x] Run generation twice and verify no drift; intentionally alter a temporary generated tree to prove the drift check fails.
- [x] Verify every public export and callable overload family appears in the rendered reference, and all local Markdown/site links resolve.
- [x] Confirm `npm pack --dry-run` still includes only the declared package files.
- [x] Complete independent review and address important findings.
- [ ] Commit and push the verified documentation work. Configure/deploy the Pages site, inspect the exact workflow run, and verify the public introduction, guide, reference, and search.
- [ ] Audit every requirement against current-state evidence before marking the goal complete.

## Verification record

- TypeScript classic and native typechecks passed; the library build passed.
- All 25 changed source files have identical comment-free compiler output to the base commit.
- Four release-documentation contracts and seven enterprise integration tests passed.
- Tutorial verification covered 20 standalone examples, three continuation groups, and seven runnable repository examples. The five server recipes were exercised for JSON responses, overlapping request isolation, missing routes, and clean shutdown.
- Documentation checks cover public exports, overload counts, generated-file drift, accurate compiler-printed signatures, Markdown staging, syntax of all 204 generated TypeScript blocks, and rendered links/anchors/assets.
- The npm dry run contains 73 permitted package files and excludes the documentation toolchain.
- Desktop, 390px mobile layout, and local search were exercised in Chromium. Development staging followed two reference-directory replacements and an atomic README save.
- Independent review approved the final changes after the renderer, callable aliases, and watcher corrections.
