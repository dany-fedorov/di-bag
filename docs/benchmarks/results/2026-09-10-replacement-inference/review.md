# Independent review: replacement output inference

Base: `0e6f3761d51be2efd6cd03f245324c0726340cf8`
Candidate: `caf61bf22d6f19dd264f534b9f7b9d4a57b3a6b6`

## Strengths

- `src/di-bag.ts:326` narrows the change to inference through the already-fixed history in the dependency-free named replacement overload. Both factory alternatives still evaluate the same `ReplacementOutput`; singleton admission, zero-dependency admission, retained module constraints, exact `V` in returned history, and the general replacement overload remain intact.
- `tests/incremental-scale.test.ts:7` tightens the deterministic work ceiling to 1,380,000, below the measured baseline 1,404,036 and above the candidate 1,364,951. The generator, pinned compiler expectation, completion checks, and resource limits remain unchanged.
- Benchmark evidence distinguishes accepted measurements from unsafe ablations, compile failures, sandbox failures, and memory termination. The 500-case figures support approximately 3.2% lower instantiation work; the documentation explicitly does not claim a memory or stack-depth fix.
- Generated API changes match the source declaration and its shifted line numbers.

## Issues

### Critical

None found.

### Important

None found.

### Minor

None found.

## Independent verification

The checkout remained clean at the reviewed candidate. No repository, index, or HEAD mutations were made during this review.

- Inspected the production and generated-documentation diffs, replacement requirement calculation, provider admission, explicit generic/reflection fixtures, contextual replacement fixtures, negative diagnostics, regression guard, and retained measurement/verification evidence.
- Ran two read-only, in-memory TypeScript 6.0.3 compiler comparisons under `/tmp/di-bag-compiler-heavy.lock`, overriding only the baseline implementation source in the compiler host. The positive comparison included the existing replacement-context, replacement-supported, and replacement-reflection fixtures plus plain, disposable, explicitly generic, and generic-forwarding replacement examples: **54 variable declarations had identical inferred type renderings; both versions had zero diagnostics**.
- A separate edge-case comparison covered manually annotated overlapping histories, retained opaque histories, provider/disposable unions, invalid union output, wrong consumer output, optional missing dependencies, nonexistent keys, and nested contextual callback examples. **All 11 exported declaration type renderings and all diagnostic codes, locations, and complete diagnostic messages were identical between baseline and candidate.** This is an equivalence check, not a claim that every deliberately invalid example is accepted.
- Verified every source and evidence hash recorded in the manifests, plus the generator and regression-test hashes: **no mismatches**.
- Independently confirmed that `892fe08`, `0fa322c`, and the review base have the identical production source tree, and that pre-rebase `0da9180` and candidate `caf61bf` have identical full trees.
- Inspected raw 500-case rows and both retained native 1,000-case memory failures. Confirmed recorded test summaries: source 123 passed / 502 assertions; package 96 passed / 1,782 assertions; native audit 639/639 expected diagnostics, 124 files, zero failures. These full-suite results were inspected, not rerun by this reviewer.
- `git diff --check 0e6f376..caf61bf` passed.

## Assessment

**Ready to merge: Yes**, subject to the normal remaining CI checks.

The bounded type-only optimization preserves the reviewed inference and validation behavior and has a meaningful regression guard. No change-specific correctness, compatibility, or evidence-integrity issue was found. Native 1,000-case completion remains an explicitly documented limitation; it does not invalidate the measured compiler-work reduction.

Review scope ends at `caf61bf`; subsequent evidence-only additions and final exact-commit large-case probes are owned by the coordinating agent.
