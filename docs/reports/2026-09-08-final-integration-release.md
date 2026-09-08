# Final adversarial integration evidence

The adversarial integration increment and local release candidate are complete at
candidate source commit `c9db88ecc1a9a990aaccdf94a54de67a0aec4772`.
This report records verification captured on 2026-09-08 and 2026-09-09 in
Europe/Kyiv; the final matrix observation was recorded at
`2026-09-08T19:06:18+03:00`, and the candidate evidence input was generated at
`2026-09-09T00:55:09+03:00`. Separately authorized branch checkpoint pushes of
`afe6326`, `284c725`, `e62a729`, and `c9db88e` ran outside the candidate command
records; the final push left local `HEAD` and `origin/feat/v0.1` equal before the
freeze. They provide no registry or publication evidence. No registry query,
network install, login, tag, provenance, credential, dist-tag, or publication
action ran.

## I1-I15 matrix

The source command was
`bun test tests/final-adversarial-integration.test.ts`. The archive checks were
four separately supervised commands: that source file, `tests/box-package.test.ts`,
`tests/package.test.ts`, and `tests/native-package.test.ts`. Together they passed
215 tests and 2,065 assertions in 318.21 seconds. Every archive execution parsed
exactly one JSON object and compared the
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

## Local release candidate

The frozen root is `c9db88ecc1a9a990aaccdf94a54de67a0aec4772` on
`feat/v0.1`; its status contains only the preserved untracked execution handoff.
The frozen sas-box checkout is clean at
`b895f9d1f1d168992f44e9f46025bc1ac9d26e14`, and val-box is clean at
`07506fcb3e49f460b6de357ecad7d88262a7f32d`. The recorded tools are Node
24.20.0, npm 11.19.0, Bun 1.4.0, classic TypeScript CLI 6.0.3, native
TypeScript 7.0.2, and TypeScript 5.9.3 in both box checkouts. The classic
wrapper package version 6.0.2 is retained separately and is not used as the CLI
version.

The evidence input reconciles exactly 72 supervised command roles: 40 for DI
Bag, 16 for sas-box, and 16 for val-box. All commands exited zero with null
signal and termination reason. The native inventory contains 27 reviewed and 27
fresh per-occurrence fingerprints. Example discovery and its independent
validator accepted exactly the nine documented files and rejected missing,
extra, duplicate, and reordered inventories before all nine examples ran
separately.

| Package | Bytes | SHA-256 | Archive file count |
| --- | ---: | --- | ---: |
| `di-bag@0.1.0` | 62,498 | `60ad1b2ccb0904188f250fc55c5ea35685e41a3e1aaeb0136b42599a0269a153` | 71 |
| `sas-box@0.1.0` | 3,397 | `23f1d407e38e28f64531515afa6b04a9514ab6d8edaec95d6c39c8cbeda77a91` | 5 |
| `val-box@0.1.0` | 6,527 | `a44566c0b07cbc0b1040075c4fbf88deab30dd5236d4a8203d7b53c16ad37e0a` | 7 |

Each package's post-build, post-dry-run, and post-pack tree documents are
byte-identical, with separately supervised comparisons bound to both inputs.
Both box post-pack statuses are empty; the DI Bag post-pack status still contains
only the handoff. Dry-run JSON, actual pack JSON, independently inspected bytes,
metadata, exports, dependency emptiness, file lists, hashes, and integrity all
agree. The public evidence is the byte-exact stable sanitized projection of the
detailed manifest and contains no absolute path or raw log content.

The offline verifier passed with `{"ok":true,"failures":[]}` in 13,496 ms at
148.703125 MiB observed peak. It copied each once-read verified archive into its
owned work directory, installed only those bytes with the fixed offline argv,
and passed the malicious archive, metadata, Node/Bun CJS/ESM, declaration,
diagnostic-region, and core-only import-tracing oracles.
Independent review then reran all 88 release-artifact tests with 431 assertions,
proved the three root archives remained byte-identical, and passed the verifier
again in a distinct work directory.

Rejected trials were not promoted or repaired in place. Two original combined
adversarial attempts exceeded the fixed 4096 MiB limit and caused the four-file
serial contract. A prior candidate was invalidated when a release test deleted
its three archives; fixture isolation now has a survival regression and received
clean independent review. A later fresh box-package attempt crossed 4096 MiB,
and its exact retry passed at 3287.0625 MiB; collecting unreachable TypeScript
program graphs after each case then produced three peaks below 1 GiB and a
double-run peak of 930.5 MiB. In this accepted candidate, the final box-package
record passed at 780.4765625 MiB. An initial evidence reconciliation rejected
four wrong record names, so roles 035-049 and every subsequent build and pack
were rerun in order under the required names. The manifest CLI also rejected an
absolute public-output argument before publication; the accepted role uses its
required repository-relative path. The runner removed incomplete records from
each rejected supervised attempt.

## Redundant release gates

| Command | Result | Observed output |
| --- | --- | --- |
| `npm run check` | exit 0 | 990 tests, 0 failures, 5,734 assertions, 50 files, 592.77 s, followed by a successful classic build |
| `bun test tests/final-adversarial-integration.test.ts` | exit 0 | 13 tests, 0 failures, 13 assertions, 1 file |
| `bun test tests/box-package.test.ts` | exit 0 | 121 tests, 0 failures, 345 assertions, 780.4765625 MiB peak |
| `bun test tests/package.test.ts` | exit 0 | 79 tests, 0 failures, 497 assertions, 3851.03515625 MiB peak |
| `bun test tests/native-package.test.ts` | exit 0 | 2 tests, 0 failures, 1,210 assertions, 1547.79296875 MiB peak |
| `npm run build` | exit 0 | final classic declaration/runtime build before pack |
| `npm run typecheck:native` | exit 0 | native TypeScript 7 strict source check |
| `npm run build:native` | exit 0 | native declaration/runtime build |
| `npm run check:native` | exit 0 | 124 files; 662 expected, 635 matched, 27 reviewed gaps, 0 unexpected, 0 failures |
| nine separate `bun run examples/<name>.ts` roles | exit 0 | exactly box-adapters, composition, contributions, modules, observers, plugins, scopes, tokens and wbs-scope |

An initial `npm test` inside the managed filesystem sandbox is excluded from
the release evidence. That environment suppressed child-process executable
paths and output, producing 36 failures and one harness error in process,
compiler and package tests. The same command with real child-process execution
passed every affected lane. The accepted candidate's supervised `npm run check`
result is the 990-test row above.

Tasks 1-4 and the candidate-blocking fixture, compiler-probe, and memory fixes
received clean independent reviews. Local evidence is complete; Task 5 binds the
ignored detailed manifest and final audit to this three-path handoff commit, with
no later tracked change. The original 83/108 compiler-scale result and 27 native
diagnostic-quality gaps remain open work. Registry availability, ownership,
access, tag, and provenance remain unavailable. No Task 5 command runs `npm view`,
`npm whoami`, `npm login`, `npm publish`, `npm dist-tag`, `git tag`, `git push`, or
a credential write; the separately authorized checkpoint pushes are disclosed
above. Fresh explicit authorization is required before online preflight or
publication.
