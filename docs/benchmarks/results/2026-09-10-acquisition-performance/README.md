# Acquisition performance evidence

Task 1 on base `6771cb413ab02ef541e273543292ee1352438db7`. The baseline snapshot's entire `src` directory was compared byte-for-byte with that commit. No graph-storage or type-helper changes are included.

The runtime hands transient outputs to callers without retaining their payloads in completed acquisition records. Execution stages discard consumed source/projection values independently of owned cleanup values. Fully drained borrowed attempts retain identity, dependency history and inspection frames; their execution machinery is compacted. Linked ancestry and an active binding/owner index avoid copying and scanning unrelated ancestors. Operation-free, non-contextual factories run directly before classification and ownership acceptance, preserving raw values and automatic/native checks.

## Paired measurements

`run-paired.py` ran 204 fresh Node 24.20.0 processes serially, three samples per case/build. Each before/after pair uses the same emitter: classic TypeScript 6.0.3 or native TypeScript 7.0.2. No stack-size increase was used. Every invocation, stdout, stderr and exit status is in `commands.jsonl`; every result, including cold-chain errors, is in `observations.jsonl`. `manifest.json` records source, emitted-build, probe and Node-test hashes. `summary.json` includes min/median/max.

`original-probe.mjs` is an unchanged copy of the original audit probe. The new probe adds ordinary automatic-mode factories, native/mapped payloads, an empty-payload history control and exact cleanup-identity controls.

Classic-emitter medians (bytes are decimal, not MiB):

| Workload | Before | After |
| --- | ---: | ---: |
| 10,000 discarded raw arrays, 256 numbers each, retained heap | 35,554,080 B | 3,958,792 B |
| 10,000 empty-payload transient records, retained heap | 14,560,680 B | 3,890,112 B |
| 10,000 native transient arrays/promises, retained heap | 37,737,632 B | 4,754,752 B |
| Native transient reachable weak targets | 20,000 | 0 |
| 10,000 mapped transient arrays, retained heap | 38,155,232 B | 5,175,280 B |
| Mapped transient reachable weak targets | 10,000 | 0 |
| Raw cold chain, 100 factories | 3.22 ms | 1.60 ms |
| Raw cold chain, 500 factories | 26.03 ms | 5.65 ms |
| Raw cold chain, 1,000 factories | stack overflow, 3/3 | 10.98 ms, success 3/3 |
| Automatic cold chain, 100 factories | 3.29 ms | 1.73 ms |
| Automatic cold chain, 500 factories | 22.93 ms | 5.40 ms |
| Automatic cold chain, 1,000 factories | stack overflow, 3/3 | 11.23 ms, success 3/3 |

Both emitters show the same retention and stack outcomes. The native emitter's original-array retained heap changes from 35,554,032 B to 3,959,744 B. All memory cases preserve 10,000 inspection attempts. The empty-payload control separates intentional attempt/dependency-history cost from service-payload retention. Owned-array controls retain all 10,000 exact cleanup values and dispose each once; they do not qualify for borrowed-execution compaction.

Cold depths 1,500, 2,000 and 4,000 still overflow in both modes/emitters. The recorded workers invoke approximately 1,148 factories after the change versus 758 raw / 759 automatic before. Their failed rows and elapsed times are preserved, not counted as successful resolutions. This change removes avoidable resolver frames; synchronous user factories still use the JavaScript stack.

## Verification

- Final tests against the baseline: 11 pass, 11 expected failures (nine payload-retention cases and two cold chains), recorded in `final-tests-baseline-red.log`.
- Complete runtime suite: 369 pass across 27 files; `runtime-tests.log`.
- Both typechecks and builds: exit 0; `typecheck*.log`, `build-classic.log`, `build-native.log`.
- Both emitted Node suites: 22 pass, including separate fresh processes for each cold chain; `node-classic-green.log`, `node-native-green.log`.
- The broader runtime/compiler run retained in `runtime-and-compiler-workers.log` had 484 passes and nine empty-child-stdout failures. Repeating exactly those two compiler-worker files outside the process sandbox passed all nine; `compiler-workers-unsandboxed.log`.

The regression work caught and fixed three intermediate mistakes: shared inspection-array identity, shutdown admission left open by a directly throwing factory, and frame retention through a saved dependency proxy after close. Their red logs remain in this directory. Existing ownership, retry, asynchronous cycles, late proxy cycles, lexical references, root/scoped boundaries, projection behavior and observer tests all pass.

CI now runs the separate retention suite with `--expose-gc --test-isolation=none` after each emitter. Weak-reference tests yield to a new job before collecting and preserve independent value, frame, call-count and cleanup-identity assertions.

Text `.log` files have trailing whitespace normalized for repository checks; command records retain the workers' exact stdout and stderr.
