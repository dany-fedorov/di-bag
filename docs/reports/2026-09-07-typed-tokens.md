# Typed-token implementation evidence

Status: Task1 internal foundation complete; public checked composition, module
integration and token-specific package/compiler gates remain in progress. This
does not complete the enterprise program or claim universal type safety.

Spec: `../superpowers/specs/2026-09-07-typed-tokens-design.md`.
Plan: `../superpowers/plans/2026-09-07-typed-tokens.md`.

## Task1: authenticated contracts and shared internal routing

Commit `1048e29ac2ecfa5a742d299bdd81fec40cab97e3` adds genuine frozen tokens,
invariant key/service identity, a fourth provider graph contract, checked internal
token source/binding helpers, and declared-symbol routing through the existing
acquisition graph. Metadata, mappings, disposal and both optional box adapters
preserve the graph contract. Ordinary factory values and native Promise identity
retain their existing behavior.

The public addition at this checkpoint is `DiBag.token(key).of<Service>()` and
type views. Nonempty or opaque token graphs are temporarily rejected by public
named composition until Task2 supplies complete token graph checks. Public
fromTokens/bind/resolve/fork/module token APIs are not claimed implemented yet.

RED began with missing APIs, separately from runtime behavior. Once handles and
the graph slot API existed, runtime tests produced3pass/7fail: selected arguments
were undefined, a token cycle did not throw and a Promise value was absent. Symbol
routing made those cases pass. An explicit-never key fixture then exposed a
missing arity rejection; a conditional arity guard addressed it without widening
normal key inference. No source/emitted type proof relies on a cast.

Verification on the committed implementation:

- Implementer `npm run check`:264pass/0fail/1560assertions across15files,
  305.77seconds of tests; strict typecheck and final declaration build passed.
  Existing100/1000-provider controls, named-module scales, source/owned cleanup,
  native Promise regressions and real package consumers all remain in that run.
- All3 existing examples passed: WBS ownership ordering, modules/fork behavior,
  and real box projections with original ownership.
- Controller independent strict typecheck/build and focused runtime/source/
  emitted/actual CJS/ESM artifact checks:30pass/0fail/250assertions in8.47seconds,
  followed by all3 examples and a clean diff check.
- No source or test changes occurred after the full run began. A restricted
  artifact attempt with empty output was not counted as success; actual artifact
  checks were rerun with approved execution permissions and visible results.
- Initial independent task review: spec compliant, task quality Approved, no
  Critical/Important/Minor findings. The controller retained full-run evidence for
  unchanged native/cleanup/inference paths that the task diff alone cannot prove.

Both independent box checkouts remain clean at sas-box `b895f9d` and val-box
`07506fc`; token integration needed no additional box implementation change.
No package was published and no branch was merged or deleted.

## Decisions and costs retained for the final review

Ruling: Capture caller-declared unique symbols in invariant token handles — equal
service types or labels cannot distinguish independent token identities — cost
if wrong is an extra key declaration and explicit canonical-token exports.

Ruling: Use one fourth provider graph contract plus existing module C/D — the
bounded corrected model retains token identity/needs without a parallel container
or fifth module generic — cost if wrong is type-instantiation and annotation
complexity; production inference and scale gates remain mandatory.

Ruling: Keep export-time public zero-needs projection, not the prototype's
install-time projection — current module architecture separates private needs in
C before public D escapes — cost if wrong is additional integration work beyond
the bounded model, to be covered by private/public/external token tests.

Ruling: Use explicit finite token tuples for positional injection while preserving
ordinary named factories — this supplies real runtime dependencies without
parameter parsing or hidden mapping-width effects — cost if wrong is positional
declaration verbosity and eager acquisition of every selected token; optional/lazy
adapters remain separate required enterprise extensions.

Ruling: Keep a temporary rejection for nonempty/opaque token graph contracts until
Task2's checked composition is implemented — internal foundations must not create
an unchecked public add/end path — cost if wrong is temporary unsupported internal
composition and test transition work; the completed increment must remove this
restriction through real validation, not narrow the final feature scope.

Ruling: Correct Task3's isolation reference to scripts/benchmark-types.ts and add
scripts/check-token-scale.ts as the single-case worker — actual type-scale tests
use in-process diagnostics with120-second test timeouts, whereas the benchmark
already uses isolated60-second Node children — cost if wrong is a small additional
test-worker file; existing production gates stay unchanged and token gates still
require real source calls, exact rejection locations and successful child exits.

Ruling: Make Task2's cross-file declaration obligation explicit by emitting the
feature producer's declarations and compiling its unchanged consumer against them
— compiling an application against di-bag.d.ts alone does not detect anonymous
unique-symbol export failures such as the carrier prototype's TS4118 — cost if
wrong is an additional compiler fixture phase; it does not add a new public API
or relax any identity/inference requirement.

## Remaining work

Task2 implements checked public binding/replacement/resolution, module C/D token
contracts, private installations and selected mixed overrides. Task3 verifies
actual package integration, feature-author declaration emission and100-token
compiler controls, adds the example and migration text. The broad final token
review follows those tasks. Larger T2, lifetimes, startup/cancellation, extensions,
observers/plugins, platform/comparison evidence and release handoff remain required.
