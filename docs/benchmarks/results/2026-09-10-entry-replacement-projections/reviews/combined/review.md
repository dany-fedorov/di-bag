# Supplemental compatibility review: final entry and replacement projections

Baseline: archived source of `3360a96516daa7483c490a1bcacaa1ed16ec7ce1`.
Candidate: `/tmp/di-bag-named-checker-probe/final-projection.types.ts`, SHA-256 `99018c35fa2432b13efdf689de4afe45163cf56602a7b42b147840f803af59e9`.
Baseline `types.ts` SHA-256: `e41819567885a7853d8ce63bac81521cc5279f6858f7e6874021ba75d4818ce6`.

The other three `final-projection` snapshots (`di-bag.ts`, `module-types.ts`, and `provider.ts`) match the archived baseline byte-for-byte. `source-identity.json` verifies all 35 source files and confirms that only `types.ts` differs.

## Strengths

- `types.ts:20-25` uses an unconditional private `RegistrationEntry<K,V>` object alias. Its key and registration fields exactly match the prior inline entry object. It preserves the existing string/symbol key intersection, union-member grouping, optional entry values, and `never`/`any` behavior. It introduces no symbol-dependent or scope-dependent entry branch.
- Generic `K,V` entry construction remains available: returning `{key,registration}` as `Entries<Record<K,V>>`, wrapping an existing entry, and forwarding named or symbol entries all pass. These are the cases that conditional entry aliases had threatened in earlier investigations.
- The previously reviewed distribution of surviving replacement keys is preserved, with comments explaining why keys are distributed and union-valued registrations stay grouped. Combined entry reconstruction and replacement-output assertions pass.
- Both pinned compiler engines validate the final combined candidate through source examples, generic wrappers, emitted declarations, fresh consumers, and retained negative diagnostics.

## Issues

Critical: none found.

Important: none found in the exact combined source above.

Minor: none requiring a change before adoption.

## Independent verification

All review work was isolated under `/tmp/di-bag-final-projection-review`. This reviewer did not mutate production files, HEAD, index, benchmark inputs, or either previous review's evidence. Compiler processes were serialized with `flock /tmp/di-bag-compiler-heavy.lock`. Runs used pinned Bun 1.4.0, classic TypeScript runtime 6.0.3, authenticated native compiler 7.0.2, and the repository's unchanged native supervision limits. Strict checking, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, and `skipLibCheck: false` were enabled.

- **Existing entry coverage:** `entries-positive.ts`, `entry-construction.ts`, and `install-wrappers.ts` from the earlier selected-resolution review pass on both versions and both engines. The 19 direct `Entries`/`From` equality cases cover readonly and optional entries, concrete and broad string/symbol maps, numeric and template keys, union maps, provider values, `never`, `any`, empty maps, and `NoInfer`. Concrete builder/module wrapper assignment and equality, batched versus individual registration, reflected module views, named installation, and typed-token installation remain valid.
- **Generic wrappers:** generic key/value construction, entry wrapping/unwrapping, reciprocal `Entries<Record<K,V>>`/legacy-record assignment, and `Builder`/`ModuleBuilder` record wrappers pass. Explicit, empty-builder, and inferred generic install adapters also pass. The accepted wrappers are emitted and used by fresh consumers.
- **Preserved baseline limitations:** the old fully arbitrary-`R` wrapper probes and additional generic equality probes produce the same 24 baseline diagnostic codes and locations. They include reciprocal equality/assignment against a separately spelled mapped type and an old failed reverse-map inference assertion. No accepted baseline case becomes rejected. These existing rejections are retained as differential evidence, not counted as successful arbitrary-`R` equality proofs. Optional registrations still fail the `Entry` constraint when fed into `From`; that baseline rejection is explicitly checked in a function body so invalid aliases do not enter emitted consumer declarations.
- **Entry inference:** factory, object, promise, callback, string-literal key, and union key inference match the baseline. Assigning the inferred unique-symbol result to a new constant still widens it to `symbol`, as on the baseline; the consumer assertion checks that actual contract. Constructed symbol entries retain their exact original key type. Replacement after a batched `Entries` history retains the exact new methods and literal return type.
- **Combined replacement checks:** 35 targeted public-output comparisons pass, comprising 15 representative direct/retained cases and 20 `Entries` → `From` → `ReplacementOutput` comparisons against the original formulas. Eight direct output assertions cover inner unions, incompatible consumers, optional versus explicitly undefined needs, self-requirement removal, and union-registration/map grouping. Existing replacement context/supported/reflection fixtures and reused extracted/specialized overload equality/assignment checks also pass. Reverse inference through `ReplacementOutput`, promises, disposal, native/raw acquisition metadata, token replacement, and dependency-bearing replacement cases remain compatible.
- **Negative contracts:** both compiler pairs match all 57 repository markers and 57 diagnostic codes/locations in eight selected replacement, module-narrowing, and rename fixtures. There are zero missing or unexpected diagnostics. Human-readable messages change in 16 classic and 11 native cases because the new private entry alias is rendered and affects diagnostic expansion/truncation; required error markers remain intact.
- **Inferred types:** all 242 top-level variable/function renderings in the final classic semantic comparison, 61 in the raw generic comparison, 188 in the declaration-stage comparison, and 29 in the fresh-consumer comparison are identical.
- **Declaration compatibility:** both versions emit 48 declaration files on each compiler with zero diagnostics. Classic changes only `src/types.d.ts`. Native additionally changes only union-arm ordering for the two individually constructed builder/module variables in `review/generic-entries-positive.d.ts`; the exact wrapper equality assertions and fresh consumers pass. All other emitted fixture declarations match byte-for-byte.
- **Fresh consumers:** both engines pass with `skipLibCheck: false`. Consumers construct named/symbol entries, wrap and unwrap generics, use all three install adapters, resolve module/token services, call extracted replacement overloads, and assert entry/replacement reverse-inference outputs. Expected failures remain checked for numeric entry construction, wrong replacement output, lost promise wrappers, erased dependency history, and missing callback dependencies.

The unchanged 352-case constraint matrix and full 600-case distributed-key matrix were not repeated. Their earlier reports remain at `/tmp/di-bag-replacement-projection-review/review.md` and `/tmp/di-bag-replacement-key-review/review.md`. This combined review adds targeted interaction and declaration checks. Full repository suites, resource measurements, and original native 1,000-case positive/negative probes remain owned by the coordinator.

Preliminary fixture mistakes (an extra closing type bracket, an overly broad module constraint parameter, and an over-specific expected symbol type) are retained with `initial-` prefixes. They failed on both versions, were corrected against the baseline, and are not acceptance evidence. Final semantic, open-generic, declaration, consumer, hash, and marker results are the evidence above.

## Reproduction

Run `bash /tmp/di-bag-final-projection-review/reproduce.sh`.

The directory contains the pinned setup, source identity manifest, fixtures, compiler worker, complete paired JSON results, declaration diffs, `summary.json`, `markers.json`, and verification scripts. Only this new scratch directory is rebuilt by reproduction.

## Assessment

**Go for the exact combined candidate**, conditional on the coordinator's full repository checks and original-limit scale gates.

The unconditional entry alias preserves the reviewed construction, inference, and wrapper contracts, and no interaction regression was found with the distributed replacement-key helper. This verdict is restricted to candidate SHA-256 `99018c35fa2432b13efdf689de4afe45163cf56602a7b42b147840f803af59e9` over the pinned baseline; subsequent changes require their own verification.
