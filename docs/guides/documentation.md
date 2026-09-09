# Writing and publishing documentation

[Introduction](../../README.md) · [Tutorial](tutorial.md) · [API overview](api-reference.md)

DI Bag's documentation starts with ordinary Markdown. The README introduces the
library, the tutorial teaches its APIs, and the server guide shows how to use
those APIs in applications. TypeDoc generates the exact API reference from the
four public TypeScript entry points. VitePress publishes these pages as a
searchable website at [dany-fedorov.github.io/di-bag](https://dany-fedorov.github.io/di-bag/).

## Work locally

Use the repository's Node version, then install both development and documentation
dependencies from their lockfiles:

```sh
npm ci
npm ci --prefix tools/docs
npm run docs:generate
npm run docs:dev
```

Open the local URL printed by VitePress with the `/di-bag/` path. Edit the original
Markdown files; the development command stages changes automatically. After
editing API comments, run `npm run docs:generate` again to update the reference.

To verify and preview the production build:

```sh
npm run docs:check
npm run docs:build
npm run docs:preview
```

## Choose the right source

| What needs changing | Edit |
| --- | --- |
| First impression, installation, quickstart | [README.md](../../README.md) |
| Concepts and examples for each API | [tutorial.md](tutorial.md) |
| Node HTTP, Express, Fastify, Bun, and Deno applications | [server-integration.md](server-integration.md) |
| API navigation and type inventories | [api-reference.md](api-reference.md) |
| A signature's explanation, parameters, return value, or failure behavior | The public declaration's comment in [src](../../src), then regenerate |
| Site navigation and appearance | [VitePress configuration](../../tools/docs/vitepress.config.mjs) and [theme](../../tools/docs/theme) |

Keep `docs/reference/` generated. Its Markdown is committed so it can be reviewed
in pull requests and read directly on GitHub. Edit source comments instead of
patching generated pages. Use `import type` for type-only API exports; the
reference must never suggest that `Bag`, `Builder`, or `Provider` are public
runtime constructors.

Write examples with enough context to reproduce them. State whether a snippet
continues an earlier example. Keep acquisition, cancellation, and cleanup rules
close to the code they explain. Link to the tutorial for a learning path and to
the generated reference for exact overloads and generic constraints.

## How generation is checked

`npm run docs:generate` uses TypeDoc, its Markdown plugin, and its VitePress theme.
It reads only `src/index.ts`, `src/node.ts`, `src/sas-box.ts`, and `src/val-box.ts`.
The rendering extension prints declarations with TypeScript so constructor
constraints, grouping, readonly fields, and const type parameters retain their
meaning. TypeDoc supplies the prose, navigation, and source links.

Generation requires comments on exported declarations and checks generated public exports and callable overloads against the TypeScript
compiler's view, parses every generated TypeScript block, validates documentation
links, and rejects internal compiler
witness fields in the public output.

`npm run docs:check` runs the tooling tests, generates a fresh temporary reference,
and compares it with the committed files. Added, changed, and removed pages all
count as drift. It also stages the site and checks that linked repository files
exist. `npm run docs:build` checks website page links while building the production
artifact, then verifies rendered anchors and asset paths under the Pages base. Run
both before pushing documentation changes.

The pinned tools and their independent lockfile live in
[tools/docs](../../tools/docs). TypeDoc uses classic TypeScript 6.0.3 because its
compiler API is required for documentation generation. The library's separate
native compiler checks remain part of development verification. The
[tooling research](../research/2026-09-09-documentation-tooling.md) records the
comparison, primary sources, and compatibility constraints.

## Website and package boundaries

The site command stages the README, Markdown in `docs/guides/`, and generated
reference pages into the ignored `tools/docs/site/` directory. It rewrites
relative links for the hosted routes; links to examples, source files, and other
repository material lead back to GitHub. Research, reports, plans, and build
evidence are not copied into the site.

The production output is `tools/docs/site/.vitepress/dist/`. Keep the configured
`/di-bag/` base when serving it as a GitHub Pages project site. Local search indexes
the built Markdown and needs no external search account. Generated pages offer
links to their source declarations; handwritten pages offer an edit link.

Documentation dependencies stay in the private tools package. The published
library archive continues to contain the manifest, README, license, and `dist/`;
it does not contain the website or its dependencies.

## Publish through GitHub Pages

The [documentation workflow](../../.github/workflows/docs.yml) checks generation
and builds the site on pull requests and pushes to `main`. Only a successful
`main` build deploys its artifact to the `github-pages` environment. A manual run
on `main` can also rebuild and deploy the site.

The repository's Pages source must be **GitHub Actions**. The deployment job uses
GitHub's short-lived Pages and identity-token permissions; no publishing token
belongs in this repository. To publish an update, regenerate changed API pages,
run the checks above, commit the sources and generated Markdown, and push.
Inspect the Documentation workflow's deployment result before claiming the
public site is updated.
