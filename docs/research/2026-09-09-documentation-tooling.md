# Documentation tooling for `di-bag`

**Research date:** 2026-09-09

**Decision:** Use VitePress 1.6.4 with TypeDoc 0.28.20, `typedoc-plugin-markdown` 4.13.0, and `typedoc-vitepress-theme` 1.1.4. Keep this toolchain in an isolated documentation package and run TypeDoc with classic TypeScript 6.0.3. Publish the resulting Markdown site to the GitHub Pages project path `/di-bag/`.

## Why this is the best fit

The desired documentation has three different jobs:

1. The root `README.md` gives a concise, hand-written introduction and points readers to the full site.
2. A hand-written tutorial teaches the library progressively and covers every public capability with examples.
3. A generated API reference records the exact exported signatures, including type-only exports, classes, type parameters, constraints, and overloads.

VitePress fits the first two jobs because Markdown is its native page format and its default theme supplies navigation, path-scoped sidebars, edit links, last-updated metadata, and in-browser full-text search. Its local search uses MiniSearch and needs no hosted search service ([VitePress search](https://vitepress.dev/reference/default-theme-search), [sidebar](https://vitepress.dev/reference/default-theme-sidebar), [site configuration](https://vitepress.dev/reference/site-config)).

TypeDoc plus the Markdown plugin fits the third job. TypeDoc constructs a semantic model with classes, interfaces, type aliases, signatures, and type parameters rather than printing declarations as plain text ([reflection kinds](https://typedoc.org/api/enums/ReflectionKind.html), [type-parameter reflection](https://typedoc.org/api/classes/TypeParameterReflection.html)). It understands overload references, including selecting an overload by index or label ([declaration references](https://typedoc.org/documents/Declaration_References.html)). The Markdown plugin then emits CommonMark/GFM-compatible pages, and its `member` router creates one page per exported member, which is appropriate for a precise, linkable reference ([output options](https://typedoc-plugin-markdown.org/docs/options/output)).

`typedoc-vitepress-theme` is worth using. It does more than save a hand-written sidebar: it changes internal anchors to VitePress-compatible anchors and emits `typedoc-sidebar.json` for direct import into the VitePress configuration ([theme overview](https://www.npmjs.com/package/typedoc-vitepress-theme), [quick start](https://typedoc-plugin-markdown.org/plugins/vitepress/quick-start)). Hand-generating only the sidebar would leave the more consequential link and anchor compatibility work to local code.

**Inference for this repository:** This stack should preserve `di-bag`'s difficult declarations because TypeDoc models overload signatures and generic type parameters, and recent TypeDoc releases fixed conversion and comments for symbols exported through `export { type X }` ([TypeDoc changelog](https://typedoc.org/documents/Changelog.html), fixes in 0.28.6 and 0.28.7). The implementation probe must still inspect representative output for a type-only facade export, a public class, and the generic overloads in `fromValBox`; upstream capability is strong evidence, but it is not proof of every repository-specific declaration shape.

Generated signatures cannot supply missing explanations. Public source declarations need focused JSDoc/TSDoc comments with `@param`, `@typeParam`, return behavior, lifecycle semantics, and examples where the signature alone is insufficient. TypeDoc supports these tags and Markdown in doc comments ([doc comments](https://typedoc.org/documents/Doc_Comments.html), [TSDoc support](https://typedoc.org/documents/Doc_Comments.TSDoc_Support.html)).

## Versions and compiler boundary

Pin exact versions in the documentation package rather than using ranges:

| Package | Pin | Verified compatibility |
| --- | ---: | --- |
| `vitepress` | `1.6.4` | Current stable 1.x release on the [npm package](https://www.npmjs.com/package/vitepress). The main VitePress site now also documents a 2.x alpha, so the pin prevents an accidental prerelease migration. |
| `typedoc` | `0.28.20` | Its source package declares Node `>=18` and a TypeScript peer range covering `5.0.x` through `6.0.x` ([package metadata](https://github.com/TypeStrong/typedoc/blob/master/package.json)). TypeDoc 0.28.18 explicitly added TypeScript 6.0 support ([changelog](https://typedoc.org/documents/Changelog.html)). |
| `typedoc-plugin-markdown` | `4.13.0` | Its source package declares `typedoc: 0.28.x` and Node `>=18` ([package metadata](https://github.com/typedoc2md/typedoc-plugin-markdown/blob/main/packages/typedoc-plugin-markdown/package.json)). |
| `typedoc-vitepress-theme` | `1.1.4` | Registry metadata declares `typedoc: 0.28.x` and `typedoc-plugin-markdown >=4.11.0` ([registry metadata](https://registry.npmjs.org/typedoc-vitepress-theme/1.1.4)). |
| `typescript` | `6.0.3` | Satisfies TypeDoc's `6.0.x` peer range and matches the repository's classic compiler implementation. |

The compiler boundary is a release constraint. Microsoft's TypeScript 7 announcement says the native compiler does not yet provide the compiler API and directs API consumers to the TypeScript 6 compatibility package ([TypeScript 7 announcement](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/)). TypeDoc's open TypeScript 7 tracker confirms that it depends on TypeScript 6 internals and does not yet support the rewritten API ([TypeDoc issue #3098](https://github.com/TypeStrong/typedoc/issues/3098)). Therefore:

- Resolve the package named `typescript` beside TypeDoc to classic 6.0.3.
- Do not let `@typescript/native` 7.0.2 satisfy or replace TypeDoc's compiler dependency.
- Continue running the repository's existing native TypeScript checks separately. A successful TypeDoc build is evidence about the classic compiler path only.
- Keep a separate lockfile for the documentation package so a root dependency update cannot silently move this boundary.

## Recommended implementation shape

Use an isolated private package at `tools/docs/` for the pinned generator and site dependencies. Commit generated API Markdown under `docs/reference/`. Build VitePress from a disposable, ignored `tools/docs/site/` staging tree assembled from an explicit allowlist: the root README, public guides, maintainer documentation, and `docs/reference/`. The repository already stores research, reports, history, benchmarks, and implementation plans below `docs/`; using all of `docs/` as the site source would risk publishing internal material. An allowlisted staging step also permits hosted page links to be rewritten without changing the GitHub-friendly links in the source Markdown.

The content boundary should be:

- `README.md`: short value proposition, installation, smallest useful example, status, and links to the tutorial and API reference.
- Hand-written site pages: concepts, start-to-finish tutorial, recipes, platform entry points, migration notes, and troubleshooting.
- Generated reference: signatures and source comments only. Configure TypeDoc with `readme: "none"` so it does not turn the root README into the API landing page.

Configure TypeDoc with explicit entry points matching the package's four public export surfaces:

```json
{
  "entryPoints": [
    "../../src/index.ts",
    "../../src/node.ts",
    "../../src/sas-box.ts",
    "../../src/val-box.ts"
  ],
  "plugin": [
    "typedoc-plugin-markdown",
    "typedoc-vitepress-theme"
  ],
  "out": "../../docs/reference",
  "router": "member",
  "readme": "none",
  "cleanOutputDir": true,
  "emit": "none"
}
```

TypeDoc normally examines the exports of each entry-point file ([input options](https://typedoc.org/documents/Options.Input.html)). Explicit files are preferable here to inferred package entry points: they document the source directly, cover all four supported import paths, and do not depend on a pre-existing `dist/` build. Do not point TypeDoc at every file under `src/`; that would turn internal implementation details into apparent public API.

Add these quality settings once source comments meet the required baseline:

- `excludePrivate: true` and an explicit policy for `@internal` plus `excludeInternal`.
- `validation.notDocumented: true` and `requiredToBeDocumented` covering the exported public kinds.
- `treatWarningsAsErrors: true` and `treatValidationWarningsAsErrors: true`.
- Keep TypeDoc's default checks for exports and invalid links/paths enabled, and keep TypeScript error checking enabled.

TypeDoc documents the validation switches and notes that `notDocumented` is off by default ([validation options](https://typedoc.org/documents/Options.Validation.html)). Turning it on immediately may expose existing comment debt; that debt should be fixed before making the check blocking rather than weakening the final gate.

During staging, have the VitePress theme emit its API sidebar into the staged site's `.vitepress` directory, then import that data and combine it with the hand-written guide sidebar. When TypeDoc runs outside the VitePress root, set the theme's `docsRoot` explicitly ([theme options](https://www.typedoc-plugin-markdown.org/plugins/vitepress/options)). Set:

- `base: "/di-bag/"` for the GitHub Pages project site.
- `themeConfig.search.provider: "local"` for service-free full-text search.
- `lastUpdated: true` and an edit link pattern if contributor navigation is useful.
- `ignoreDeadLinks: false` so the production build checks internal documentation links.

VitePress's GitHub Pages guide requires the repository-name base for `https://<owner>.github.io/<repository>/` and gives an Actions workflow that builds and uploads `.vitepress/dist` ([deployment guide](https://vitepress.dev/guide/deploy)). The workflow should install the isolated package from its lockfile, regenerate the reference, build the site, upload the site artifact, and use GitHub's Pages deployment action.

## Drift and precision gates

Commit the generated Markdown in `docs/reference/`. This makes API changes reviewable in pull requests and leaves a readable reference in a source checkout. Generate the sidebar data into the disposable site tree from that same reference. Make both operations deterministic and enforce these CI gates:

1. Run the existing classic and native library checks.
2. Run TypeDoc with classic TypeScript 6.0.3.
3. Fail on TypeDoc and documentation warnings.
4. Build VitePress with dead-link checking enabled.
5. Regenerate the committed reference and require `git diff --exit-code -- docs/reference`.
6. Check representative output for each high-risk declaration form: a type-only re-export, a class with public methods, a constrained generic type, and every overload of `fromValBox`.

The last check should preferably inspect TypeDoc's JSON reflection model or assert stable semantic markers rather than compare entire Markdown files in a test. Whole-directory drift is already covered by the Git diff; the focused check exists to catch a generator regression that produces stable but incomplete pages.

## Alternatives considered

| Stack | Strengths | Material cost for `di-bag` | Decision |
| --- | --- | --- | --- |
| VitePress + TypeDoc Markdown | Native Markdown pages, built-in local fuzzy search, target-specific TypeDoc anchors/sidebar, simple Pages base configuration. | No documented first-class version snapshot command or version dropdown. | Best current fit. |
| Starlight + TypeDoc Markdown | Markdown/MDX content, automatic filesystem sidebar, Pagefind search enabled by default, and an official Astro Pages action ([pages](https://starlight.astro.build/guides/pages/), [sidebar](https://starlight.astro.build/guides/sidebar/), [configuration](https://starlight.astro.build/reference/configuration/), [Astro Pages deployment](https://docs.astro.build/en/guides/deploy/github/)). | The TypeDoc Markdown project provides target themes for VitePress and Docusaurus, but not Starlight ([package list](https://github.com/typedoc2md/typedoc-plugin-markdown)). Starlight pages require title metadata, so generated output needs frontmatter/configuration glue. Starlight also labels itself beta ([getting started](https://starlight.astro.build/getting-started/)). | Good general docs UI, but more integration code and upgrade churn for this API-reference requirement. |
| Docusaurus + TypeDoc Markdown | Maintained `docusaurus-plugin-typedoc` integration, generated sidebar support, and first-class version snapshot/dropdown commands ([TypeDoc integration](https://typedoc-plugin-markdown.org/plugins/docusaurus/quick-start), [Docusaurus versioning](https://docusaurus.io/docs/versioning)). | Docusaurus treats Markdown as MDX by default, which can reject otherwise valid API comment text; the integration documents a CommonMark mode as a workaround ([MDX guide](https://www.typedoc-plugin-markdown.org/plugins/docusaurus/guides/mdx)). Official search centers on hosted Algolia while local search options are community plugins ([search](https://docusaurus.io/docs/search)). Its own versioning guide warns that snapshots add build time and complexity. | Choose only if archived, selectable documentation versions are required now. |

**Inference about version controls:** The reviewed VitePress and Starlight configuration references do not expose a first-class equivalent to Docusaurus's `docs:version`. For the current `0.1.0` library, display the current package version in navigation and publish one canonical site. If the project later commits to maintaining several released documentation snapshots, either add an intentionally designed directory-and-selector layer or move to Docusaurus; do not imply that VitePress supplies version lifecycle management by default.

## Release constraints

Adopt the selected stack with these non-negotiable constraints:

- Keep the exact version pins and the docs package lockfile.
- Keep TypeDoc on classic TypeScript 6.0.3 until TypeDoc officially ships native TypeScript API support.
- Generate from the four public source entry points only.
- Keep hand-written teaching material separate from generated signatures.
- Assemble the ignored VitePress staging tree from an explicit public allowlist; never copy research, reports, history, benchmarks, or implementation plans into it.
- Use `/di-bag/` as the site base and validate the built artifact under that prefix.
- Block merges when source exports, generated Markdown, sidebar data, or internal links drift.
- Review the generated reference for type-only exports, classes, generics, and overloads before the first public deployment.

This recommendation favors the smallest maintained integration that satisfies Markdown authoring, exact TypeScript API generation, local search, and GitHub Pages hosting. Docusaurus remains the clear fallback if multi-version documentation becomes a present requirement rather than a future possibility.

## Repository probe and final integration

The implementation probe generated 108 Markdown pages and confirmed all four
entry-point inventories. It also found that the Markdown plugin's default type
printer loses some TypeScript syntax: constructor `new`, grouping parentheses,
`const` type parameters, and inline readonly option fields. Changing
`useCodeBlocks` did not fix those cases. This is direct evidence from this
repository's declarations, rather than a claim that every TypeDoc output has
these defects.

The integration therefore uses TypeDoc for API discovery, comments, navigation,
and source links, with a local rendering extension that prints declarations
through TypeScript. Focused checks retain the affected constructor, conditional,
readonly-option, and type-only-function cases. The compiler export/overload
comparison remains a separate gate: completeness and faithful rendering are
different requirements.
