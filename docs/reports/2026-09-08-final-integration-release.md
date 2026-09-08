# Final adversarial integration evidence

The adversarial integration increment is locally complete at reviewed checkpoint
`e93b0a5435e2ee6a2ec339605389c800043deb4e`. This report records verification
captured on 2026-09-08 in Europe/Kyiv; the final matrix observation was recorded
at `2026-09-08T19:06:18+03:00`. No registry query, network install, login, push,
tag or publication action ran.

## I1-I15 matrix

The source command was
`bun test tests/final-adversarial-integration.test.ts`. The archive command was
`bun test tests/final-adversarial-integration.test.ts tests/box-package.test.ts tests/package.test.ts tests/native-package.test.ts`.
The latter passed 215 tests and 2,065 assertions across four files in 318.32
seconds. Every archive execution parsed exactly one JSON object and compared the
complete object with `finalAdversarialExpectedResult`; no partial-field result
was accepted. The archive routes comprised the classic archive under Node CJS
and ESM, fixed real-box archives under Node and Bun CJS and ESM, and archives
emitted independently by classic6 and native7 under Node and Bun CJS and ESM.
The physical declaration routes removed the producer source before downstream
classic and native compilation. All rows below exited zero without a timeout,
signal, out-of-memory result or skip at the recorded timestamp.

| ID | Source setup | Exact expected result | Source/archive evidence | Timestamp |
| --- | --- | --- | --- | --- |
| I1 | Real `SasBox`/`ValBox` chain with two ownership layers | payload, metadata and alias identities `true`; dispose `['payload','sas']`; acquisitions `1` | Source and every runtime archive route | `2026-09-08T19:06:18+03:00` |
| I2 | Native root/scoped/transient acquisition graph | native/root identity `true`; child dispose `['transient-2','transient-1','scoped']`; parent adds `'root'`; acquisitions `4` | Source and every runtime archive route | `2026-09-08T19:06:18+03:00` |
| I3 | Absent, present-undefined and throwing snapshot boundaries | all three identities `true`; dispose `['source']`; acquisitions `3` | Source and every runtime archive route | `2026-09-08T19:06:18+03:00` |
| I4 | Validated plugin output failure over SasBox ownership | phase `output`; error/startup-cause identity `true`; wrapper `DiBagStartupError`; dispose `['plugin','sas']`; payload disposals `0`; acquisitions `1` | Source and every runtime archive route | `2026-09-08T19:06:18+03:00` |
| I5 | Contribution failure, retry and startup rollback | direct retained `true`; direct dispose `['direct-1']`; startup wrapper/cause exact; startup dispose `['startup-first']`; retry fresh `true` | Source and every runtime archive route | `2026-09-08T19:06:18+03:00` |
| I6 | Alias, repeated module installation and selected sharing | alias acquisitions `0`; shared identity and unshared distinction `true`; dispose `['installation-2','installation-1']`; acquisitions `2` | Source and every runtime archive route | `2026-09-08T19:06:18+03:00` |
| I7 | Root/scoped/transient/contribution cleanup failure | counts `1/1/2/2`; original cleanup failure identity `true`; independent cleanup count `5` | Source and every runtime archive route | `2026-09-08T19:06:18+03:00` |
| I8 | Two filtered observers, observer throw and late cleanup | callback order `['A:acquisition-ready','B:acquisition-ready','A:cleanup-completed','B:cleanup-completed']`; calls `4/1/0`; error/event identities `true`; close unblocked; late disposals `1` | Source and every runtime archive route | `2026-09-08T19:06:18+03:00` |
| I9 | Automatic and raw structural-thenable paths | automatic effects `0`; raw identity `true`; then reads `0`; raw disposals `1` | Source and every runtime archive route | `2026-09-08T19:06:18+03:00` |
| I10 | Sync/raw/async capability routing and classifier failure | sync/raw identities `true`; pre-async reads `0`; async reads `1`; failure identity `true`; disposer calls `0` | Source and every runtime archive route | `2026-09-08T19:06:18+03:00` |
| I11 | Failed snapshot eviction, retry and source ownership | boundary error identity and fresh retry `true`; dispose `['source','source']` | Source and every runtime archive route | `2026-09-08T19:06:18+03:00` |
| I12 | Ordinary, aborted and timed-out startup with late ownership | exact startup/cancellation wrappers and causes; cleanup failures `0`; timeout cause `TimeoutError`; dispose `['late','immediate']` | Source and every runtime archive route | `2026-09-08T19:06:18+03:00` |
| I13 | Closing lazy admission, parent/child ownership and independent fork | closing effects `0`; parent dispose `['child','parent']`; final dispose `['child','parent','fork']`; unshared distinction `true` | Source and every runtime archive route | `2026-09-08T19:06:18+03:00` |
| I14 | Real-box/token/module/plugin type producer, source-hidden consumer and two independent negative regions | positive diagnostics `0` in source/CJS/MJS; classic negative markers `2`; new native gap IDs `[]` | Classic source, installed CJS/MJS declarations, both physical emitters, both downstream compilers, plus complete archive JSON | `2026-09-08T19:06:18+03:00` |
| I15 | Package contents and import-graph isolation | CJS/ESM match source `true`; core has boxes `false`; root loads Node `false`; forbidden files `0` | Bounded archive allowlist with zero forbidden files, core-only Node/Bun CJS/ESM, and import tracing that rejects every bare import including package self-reference | `2026-09-08T19:06:18+03:00` |

## Contract correction

Task 1 intentionally exposed I12 as the sole red row: the initial oracle
expected immediate ownership before ownership accepted after cancellation, while
the implementation produced `['late','immediate']`. Review traced the behavior
through startup cancellation into `disposeAll()` and checked the documented
cleanup contract. Cleanup waits for pending ownership to settle and then closes
unrelated successful acquisitions in reverse acquisition order. The late value
is accepted after the immediate value, so `['late','immediate']` is the required
sequence. Commit `e93b0a5` corrected the specification and oracle without a
production source change. Focused source, timeout, abort, installed archive and
full-suite runs all exercise the corrected sequence.

## Native diagnostic inventory

The reviewed inventory and the fresh inventory are identical. Each entry is
`fixture:marker-line gap-id`:

```text
incremental.ts:12 last-token-string
incremental.ts:15 last-token-string
incremental.ts:26 last-token-string
incremental.ts:46 last-token-string
inline-replacement-wrong-shape.ts:3 last-token-string
module-hidden-private-needs.ts:16 last-token-string
module-narrowing.ts:22 last-token-string
module-rename.ts:21 last-token-string
provider-boundaries.ts:40 last-token-string
replacement-context.ts:10 last-token-string
replacement-context.ts:13 last-token-string
replacement-context.ts:16 last-token-string
replacement-context.ts:19 last-token-string
replacement-context.ts:24 last-token-string
replacement-context.ts:28 last-token-string
replacement-context.ts:32 last-token-string
replacement-context.ts:35 last-token-string
replacement-context.ts:43 last-token-string
replacement-context.ts:46 last-token-string
replacement-context.ts:49 last-token-string
replacement-context.ts:52 last-token-string
replacement-wrong-shape.ts:3 last-token-string
required-this.ts:8 last-token-string
union-replace.ts:7 last-token-string-union
union-replace.ts:10 last-token-string
union-replace.ts:13 last-token-open-template
union-replace.ts:16 last-token-string
```

The multiset is 25 `last-token-string`, one `last-token-string-union` and one
`last-token-open-template`. Removed IDs: `[]`. New IDs: `[]`. The fresh native
audit checked 124 files and exited zero with 662 expected diagnostics, 635 useful
matches, 27 reviewed native rejections, all 11 supplemental diagnostics matched,
zero unexpected diagnostics and zero failed fixtures. I14 itself introduces two
classic negative markers and no native gap.

## Redundant release gates

| Command | Result | Observed output |
| --- | --- | --- |
| `npm run typecheck` | exit 0 | classic TypeScript 6 strict source check |
| `bun test tests/final-adversarial-integration.test.ts` | exit 0 | 13 tests, 0 failures, 13 assertions, 1 file |
| `npm test` | exit 0 | 902 tests, 0 failures, 5,305 assertions, 49 files, 575.06 s |
| `npm run build` | exit 0 | classic declaration/runtime build |
| `npm run typecheck:native` | exit 0 | native TypeScript 7 strict source check |
| `npm run build:native` | exit 0 | native declaration/runtime build |
| `npm run check:native` | exit 0 | 124 files; 662 expected, 635 matched, 27 reviewed gaps, 0 unexpected, 0 failures |
| `for file in examples/*.ts; do bun run "$file"; done` with `set -e` | exit 0 | exactly nine individual examples passed: box-adapters, composition, contributions, modules, observers, plugins, scopes, tokens and wbs-scope |
| `bun test tests/final-adversarial-integration.test.ts tests/box-package.test.ts tests/package.test.ts tests/native-package.test.ts` | exit 0 | 215 tests, 0 failures, 2,065 assertions, 4 files, 318.32 s |

An initial `npm test` inside the managed filesystem sandbox is excluded from
the release evidence. That environment suppressed child-process executable
paths and output, producing 36 failures and one harness error in process,
compiler and package tests. The same command with real child-process execution
passed all 902 tests; every previously affected lane was green.

Tasks 1-4 received independent reviews and their corrections are present in the
checkpoint. Task 5 also received independent review; its one Important wording
finding was corrected by describing I15's actual bounded allowlist rather than
claiming a complete expected-file inventory. The original 83/108 compiler-scale
result and 27 native diagnostic-quality gaps remain open work. Release
preparation and every external publication action remain open.
