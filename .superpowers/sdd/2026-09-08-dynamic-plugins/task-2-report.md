# Task 2 report — physical plugin routes, example and P1 evidence

Status: DONE_WITH_CONCERNS

Primary implementation commit: `ff7509d test: verify dynamic plugin package boundary`

## RED/GREEN

The archive fixture was routed before implementation. Managed-sandbox child
process interception returned synthetic empty output, so the initial package
attempt failed while parsing empty stdout rather than asserting product behavior.
The unrestricted physical archive RED then found three real integration gaps:

1. An unannotated extracted `DiBag.fromPlugin` method was not nameable in emitted
   declarations because `fromPlugin` was not reachable through the root package.
2. The physical consumer route did not rewrite `import('./plugins')` type queries
   after deleting the producer source.
3. The native strict negative matcher rejected the broad `not assignable` marker;
   its actual missing-mode diagnostic is `Property 'acquisition' is missing`.

GREEN exports the function type identity from the root, rewrites the dynamic type
queries, and records the strict compiler wording. The shared archive assertions
then prove descriptor preflight, raw/native validation, original ownership,
dependency references, private aliases/sharing, observer identity and portable
raw-core behavior.

## Verification evidence

| Command | Exit/result |
| --- | --- |
| `bun test tests/types.test.ts -t plugins` | 0; 3 pass, 11 assertions, 3.17s |
| `bun test tests/package.test.ts --verbose` | 0; 77 pass, 495 assertions, 58.58s |
| `bun test tests/native-package.test.ts --timeout 120000 --verbose` | 0; 2 pass, 656 assertions, 118.86s |
| `npm run typecheck:native` | 0 |
| `npm run build:native` | 0 |
| `npm run check:native` | 0; native 7.0.2; 113 files; 647 expected, 620 matched; 27 pre-existing declared gaps; zero failures |
| `npm run check` | 0; 720 pass, 3,830 assertions, 596.23s; classic build follows |
| all nine examples, serially | 0; plugin example output `HELLO` |

The process-spawning package/archive/compiler commands used unrestricted execution
because the managed sandbox returns empty/synthetic Bun child-process results.

## Files changed

- `src/index.ts` — root type reachability for unannotated physical declarations
- `tests/plugins-runtime-fixture.ts`
- `tests/package.test.ts`
- `tests/native-package.test.ts`
- `tests/box-contract-fixtures.ts`
- `tests/types/negative/plugins.ts`
- `examples/plugins.ts`
- `README.md`, `CHANGELOG.md`, `docs/migrations/0.1-to-enterprise.md`
- `docs/superpowers/plans/2026-09-08-dynamic-plugins.md`
- `docs/reports/2026-09-08-dynamic-plugins.md`

## Self-review

The shared assertion string executes only real public archive behavior. Every
plugin disposer asserts exact acquired identity. The physical declaration test
deletes producer source and uses each emitter plus each compiler. The example
shows application-selected unknown code, a required synchronous predicate,
typed module composition and once-only cleanup. `git diff --check` passed before
the primary implementation commit.

## Concerns and limitations

- The 27 native diagnostic-message gaps are existing accepted audit declarations;
  no plugin region is a gap.
- Independent Task 1/Task 2 spec/quality and whole-increment review are
  controller-owned and have not been claimed here.
- Push/publish are out of scope and were not attempted.

## Fix round 1 — shutdown boundaries and tracker evidence

Commit: `3250bb7 test: cover plugin shutdown boundaries`

The shared archive assertion now holds three independent promises: native source
settlement, failed-validation disposal, and observer callback work. It proves a
failed raw validation starts disposal with the exact rejected source but keeps
`close()` pending until that disposer settles. Native shutdown first remains
pending for source validation, then remains pending again for the exact fulfilled
source's asynchronous disposer. Lifecycle observation now returns an
application-owned pending callback promise; `close()` completes while that work is
still pending, then the fixture releases it to leave no dangling work.

The tracker no longer calls the broad verification gate reviewed while review is
open. It records local commitment as completed and preserves a distinct pending
conditional push/remote-SHA gate.

| Command | Exit/result |
| --- | --- |
| `bun test tests/plugins.test.ts` | 0; 18 pass, 86 assertions, 38ms |
| `bun test tests/types.test.ts -t plugins` | 0; 3 pass, 11 assertions, 3.17s |
| `bun test tests/package.test.ts --verbose` | 0; 77 pass, 495 assertions, 56.31s |
| `bun test tests/native-package.test.ts --timeout 120000 --verbose` | 0; 2 pass, 656 assertions, 118.63s |
| `npm run check:native` | 0; 113 files, 647 expected regions, 620 matched, 27 existing declared gaps, zero failures |

Self-review: the gates are independent and use the real archive provider,
disposer and observer paths. The pending observer assertion explicitly checks
callback work has not settled after `close()`. No Minor reviewer item was changed.
