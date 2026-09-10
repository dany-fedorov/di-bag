from pathlib import Path
import hashlib, json, shutil, subprocess

repo = Path('/tmp/di-bag-replacement-spike')
stage = Path('/tmp/di-bag-final-projection-evidence')
measurements = Path('/tmp/di-bag-final-projection-measurements')
summary = json.loads((measurements / 'summary.json').read_text())
identity = json.loads((stage / 'source-manifest.json').read_text())
assert summary['candidate'] == identity['candidate'] == '59d10c6c8ac13d63171f9f39c170da048d7e208c'
assert summary['baseline'] == identity['baseline'] == 'fb5fe6c736fc0c21b32b93dfc9e170c955209bb9'
assert subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=repo, text=True).strip() == summary['candidate']
dirty = subprocess.check_output(['git', 'status', '--porcelain=v1', '-z'], cwd=repo).decode().split('\0')
assert all(record[3:].startswith('docs/') for record in dirty if record)
for name, record in identity['productionFiles'].items():
    assert hashlib.sha256((repo / 'src' / name).read_bytes()).hexdigest() == record['candidate']
assert summary['cases'] == 40
for row in summary['original1000']:
    if row['lane'] == 'native' or row['form'] in ('bindings', 'modules'):
        assert row['accepted'], row
    else:
        assert not row['accepted'] and row['reason'] == 'compiler stack overflow', row
assert summary['accepted'] == 34 and summary['failed'] == 6
gates = json.loads((stage / 'gates/di-bag-final-projection-integration-verification.json').read_text())
assert len(gates) == 18 and all(row['status'] == 0 for row in gates)
log = (stage / 'gates/di-bag-final-projection-integration-full-check.log').read_text()
assert '943 pass' in log and '0 fail' in log and '18899 expect() calls' in log
shutil.copytree(measurements, stage / 'measurements', dirs_exist_ok=True)

lines = [
    '# Entry and replacement compiler projections — 2026-09-10', '',
    'The original 1,000-operation native named-registration and replacement cases now pass, including their missing/wrong-shape error controls. All original binding/module cases remain accepted on both compilers. Classic TypeScript still overflows on the 1,000-call named and replacement forms; those six valid/error rows remain failures.', '',
    f"The clean final collection contains **{summary['cases']} rows: {summary['accepted']} accepted and {summary['failed']} failed**. Baseline: `{summary['baseline']}` (PR 9 merge). Measured source: `{summary['candidate']}`. Later evidence commits preserve this production source.", '',
    '## What changed', '',
    '- A private `ReplacementFactory<O>` names the contextual replacement return type while preserving its explicit receiver, `NoInfer`, overload order and admission checks.',
    '- The private `WrongConstraint` helper delays the same `Provided<A>` projection until a named-dependency constraint needs it.',
    '- A private `RegistrationEntry<K,V>` gives the compiler a literal key to compare before the full registration type. The public `Entries` mapped type keeps its original keys and object fields.',
    '- Local replacement requirements distribute over surviving keys without allocating a mapped property for every absent requirement. Each union-valued registration stays grouped; implicit needs optionality and explicit `undefined` retain their previous meanings.', '',
    'These are type-level changes in three production files. Runtime implementations, scale generators, diagnostic acceptance rules, dependency versions and supervisor limits are unchanged. The complete 35-file identities and unchanged compiler inputs are recorded in [source-manifest.json](source-manifest.json).', '',
    '## Clean performance comparison', '',
    '| 500-operation form | Classic instantiations before → after | Native instantiations before → after |',
    '| --- | ---: | ---: |',
]
for form in ('chained', 'replacement', 'bindings', 'modules'):
    cells = []
    for lane in ('classic', 'native'):
        row = next(row for row in summary['comparisons'] if row['form'] == form and row['lane'] == lane)
        cells.append(f"{row['beforeInstantiations']:,} → {row['afterInstantiations']:,} ({-row['reductionPercent']:+.3f}%)")
    lines.append(f"| {form} | {cells[0]} | {cells[1]} |")
lines += ['', '| 500-operation form | Compiler | Process time before → after | Observed peak RSS before → after |',
          '| --- | --- | ---: | ---: |']
for row in summary['comparisons']:
    before_rss, after_rss = row['beforeMaxRssMiB'], row['afterMaxRssMiB']
    rss = f'{before_rss:.2f} → {after_rss:.2f} MiB' if isinstance(before_rss, (int, float)) and isinstance(after_rss, (int, float)) else 'unavailable; inspect raw row'
    lines.append(f"| {row['form']} | {row['lane']} | {row['beforeProcessMilliseconds']/1000:.3f} → {row['afterProcessMilliseconds']/1000:.3f} s | {rss} |")
lines += ['', '| Original 1,000-operation form | Scenario | Compiler | Accepted | Result | Process time | Observed peak RSS |',
          '| --- | --- | --- | --- | --- | ---: | ---: |']
for row in summary['original1000']:
    result = ('zero diagnostics' if row['scenario'] == 'valid' else 'intended boundary error; no TS2589') if row['accepted'] else row['reason']
    rss = f"{row['maxRssMiB']:.2f} MiB" if isinstance(row['maxRssMiB'], (int, float)) else 'unavailable'
    lines.append(f"| {row['form']} | {row['scenario']} | {row['lane']} | {'yes' if row['accepted'] else 'no'} | {result} | {row['processMilliseconds']/1000:.3f} s | {rss} |")
lines += ['',
    'Accepted negative rows mean invalid code was rejected at the original marked boundary without TS2589. All cases use fresh processes, default stacks, a 60-second deadline and 4 MiB captured-output bound. The classic worker retains its 3,072 MiB V8 old-space heap limit (`--max-old-space-size=3072`); the native supervisor retains its separate 3,072 MiB sampled RSS bound. Classic observed RSS is reported but is not enforced by that heap option. Classic runtime is 6.0.3; the authenticated native compiler is 7.0.2. All paired 500-operation rows have identical generated source. Timings and observed RSS are single observations on this host, not portable guarantees. The raw [40 rows](measurements/rows.jsonl), [derived summary](measurements/summary.json) and [collection manifest](measurements/manifest.json) retain successful and failed results, commands, diagnostics, resource measurements and source hashes.', '',
    'This collection repeats all 24 original 1,000-operation valid/error cases for these four forms. It does not relabel or claim a rerun of the historical 108-row matrix. The remaining classic failures are still under investigation; the evidence does not establish that they are unavoidable library-independent limits.', '',
    '## Diagnostic profiles and intermediate results', '',
    'Native CPU profiling of the original 500-call named form found 15.81 of 23.43 sampled CPU seconds (67.48% flat) in `ast.GetSourceFileOfNode`, mostly beneath union type-mapper comparisons. After the combined change the profile contains 7.32 sampled CPU seconds and no flat samples in that function. No samples does not mean zero actual execution. Our inference is that comparing distinct entry keys earlier avoids repeatedly walking source-file ancestry while comparing retained registration maps. These diagnostic runs use `--pprofDir` and are separate from the clean acceptance measurements.', '',
    'The profile baseline is intermediate source `3360a96516daa7483c490a1bcacaa1ed16ec7ce1`, not the PR 9 baseline used in the table. All 35 baseline/final source files were checked against those exact revisions. The [before summary](probes/di-bag-named-checker-probe/native500-cpu-summary.json), [after summary](probes/di-bag-named-checker-probe/native500-final-cpu-summary.json) and [complete named probes](probes/di-bag-named-checker-probe/complete-probes.tar.gz) retain raw gzip profiles, sources, readers and caller analysis. The reader follows the standard [pprof profile schema](https://github.com/google/pprof/blob/main/proto/profile.proto).', '',
    'The intermediate two-file candidate passed native 1,000 replacements at 3,058.11 MiB observed RSS, leaving only 13.89 MiB below the original bound. Its [historical 40-row overview](intermediate/README.md), [summary](intermediate/summary.json), and [complete evidence archive](intermediate/complete-evidence.tar.gz) remain preserved with their original source and checksums. That narrow margin motivated the additional key-distribution change. Historical text in the archived intermediate report describes the common limit as RSS; the lane-specific distinction above corrects that wording without changing the archived measurements or their manifest. The distributed-only prototype used 80,882,355 native instantiations and 2,477.51 MiB at 1,000 replacements; the combined entry change costs some replacement work relative to that prototype while also fixing native named chains. [Replacement probe evidence](probes/di-bag-replacement-key-probe/complete-probes.tar.gz) retains the comparison. Prototype measurements are not substituted for the clean final rows above.', '',
    'Rejected experiments are retained in the archives: filtering mapped requirement keys increased work and timed out, and an extra add-input alias left the classic stack failure unchanged. Earlier conditional/scoped entry aliases failed generic construction or wrapper compatibility and are not used. Classic diagnostic stack traces remain evidence of a failure, not a proof of an upstream-only cause.', '',
    '## Compatibility and validation', '',
    'Three independent, successive reviews found no change-specific blocker: [context and constraints](reviews/context-constraints/review.md), [distributed replacement keys](reviews/replacement-keys/review.md), and [the exact combined entry/replacement source](reviews/combined/review.md). Their adjacent `complete-review.tar.gz` archives preserve all raw paired results, declarations, consumers, fixtures and scripts. The first review covers 352 concrete constraint cases; the second covers 600 paired public replacement-output assertions; the combined review adds generic entry construction and wrappers, 35 targeted output comparisons, 57 negative markers, 48 emitted declarations per version/engine and fresh strict consumers. These are successive scopes, not a claim that all matrices were repeated in the last review. Baseline-rejected generic probes remain recorded as differential failures, not successful equality proofs.', '',
    'Local validation passed **943 tests, zero failures and 18,899 assertions**, both compiler builds and source typechecks, **31 emitted Node regressions per compiler**, and the strict native audit (**639/639 expected diagnostics across 124 files**, zero unexpected diagnostics). Generated references, documentation checks and all nine examples passed. All 18 steps and their raw logs are in [the verification manifest](gates/di-bag-final-projection-integration-verification.json). Pinned Bun 1.4.0 was used, the ignored local platform manifest was refreshed before the run, and npm update notifications were disabled to match CI.', '',
    'Regression tests retain both original native 1,000-operation valid probes and tighten the classic 100-replacement ceiling to 1,030,000 instantiations. The new generic entry constructor and replacement-output characterizations first passed against the previous source. The new performance gates failed on that previous source, then passed with the final implementation; the RED, baseline-characterization and GREEN logs are retained under `gates/`. Hosted CI and merge verification are tracked on the pull request.', '',
    '## Reproduction and artifact identity', '',
    'Use the pinned dependencies from the repository and clean checkouts at the baseline and measured revisions. The collection and review scripts preserve the original local `/tmp` workspace paths; adjust those paths to equivalent isolated checkouts before running elsewhere. Extract a review or probe archive into its matching scratch directory before using its reproduction script. Run `collect.py <measured-source>`, then `summarize.py`; `stage.py` and `finalize.py` package the evidence. Compilation was serialized through `/tmp/di-bag-compiler-heavy.lock` so benchmark processes did not overlap suites or other compiler probes.', '',
    '[artifact-manifest.json](artifact-manifest.json) checksums every other file in this published artifact directory, including nested manifests and complete archives. The historical intermediate manifest applies to the original archive contents; the outer manifest separately covers the copied historical overview. Archives contain only relative regular-file paths and omit `node_modules` and symlinks.', '',
]
(stage / 'README.md').write_text('\n'.join(lines))
shutil.copyfile('/tmp/di-bag-final-projection-finalize.py', stage / 'finalize.py')
files = {str(path.relative_to(stage)): {'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'bytes': path.stat().st_size}
         for path in sorted(stage.rglob('*')) if path.is_file() and path != stage / 'artifact-manifest.json'}
(stage / 'artifact-manifest.json').write_text(json.dumps({'sourceCommit': summary['candidate'], 'baseline': summary['baseline'], 'files': files}, indent=2) + '\n')
print(json.dumps({'files': len(files) + 1, 'bytes': sum(row['bytes'] for row in files.values()), 'accepted': summary['accepted'], 'failed': summary['failed']}))
