# Compiled lifetime-carrier investigation

Status: advisory feasibility evidence, not an adopted representation or completed
lifecycle feature. Baseline: `b12449d9764330f9ce65ef739eee68660caf1b22`.
Binding design: `../superpowers/specs/2026-09-06-lifecycle-design.md`.

## Result

A bounded throwaway signature model extends the existing provider G with lifetime
policy and a lexical-source reference while retaining Provider F/M/A/G and Module
P/R/C/D. Module C keeps its named/token shape-row vocabulary and adds lexical graph
records. Public D still has zero public needs but points to the original local
registration. This is a plausible candidate; it has not been ported to production.

The model preserves private dependency checks through export, rename and one level
of nested module installation/sealing. A private name remains private when a later
host happens to use the same name. Exportless modules retain independent private
root obligations. Named and token examples both retain shape and lifetime checks.

The candidate root-boundary interpretation checks each root independently: strict
root A may consume root B that explicitly permits scoped capture, while a separate
permissive root cannot excuse an unrelated strict root. This interpretation was
tested in the model, not adopted as runtime policy.

## Independent verification

The controller read the full model, producer, consumer, runner and advisory report,
then reran all four bounded compiler phases. TypeScript 5.9.3 / Node 24.20.0,
strict mode, CommonJS/Node resolution, ES2022, skipLibCheck. Each compiler had a
10-second timeout and 384 MiB V8 old-space cap; this is not a total-RSS limit.

| Phase | Exit / diagnostics | Wall time | Maximum RSS |
| --- | --- | ---: | ---: |
| Source model, inferred producer and consumer | 0 / none | 0.64 s | 212,828 KiB |
| Model and inferred producer declaration emission | 0 / none | 0.60 s | 209,780 KiB |
| Byte-identical consumer against emitted declarations | 0 / none | 0.74 s | 252,376 KiB |
| Same consumer with expectation comments mechanically disabled | 2 / 26 intended errors | 0.75 s | 256,460 KiB |

The source and declaration consumers share SHA-256
`5210ced93ad2c4c916771037c74619df52be054963196fd760df392e62b41d14`.
Loaded-file evidence excludes the model/producer sources from the declaration
consumer. Raw errors occur only at the intended lines:
13, 17, 21, 23, 25, 30, 33, 36, 38, 42, 44, 47, 51, 54, 56, 58, 61, 64,
66, 68, 71, 74, 78, 80, 82 and 84. They include root capturing scoped,
invalid non-root capture options, invariant token mismatch, wrong binding output,
missing/incorrect named dependencies and opaque provenance. No timeout or OOM
counts as a type rejection.

Actual calls cover host root through a transient export to a private scoped
dependency; exportless private root through transient to external scoped;
corresponding root/capture positives; independent roots; replacement/rename;
nested private targets; token and default-provider annotations; and a transient
cycle whose separate scoped edge must still reject. Expected-error directives
remain in the positive compilation, so unexpectedly accepted calls fail it.

## Costs and limits

- Declaration expansion is already substantial: a 4,915-byte producer emitted
  77,410 bytes / 1,674 lines. These sub-second runs establish no scale or editor-
  latency guarantee. A separate fifth-provider-carrier alternative was compared
  structurally but not compiled; no performance advantage has been demonstrated.
- Extending G requires broad policy/source matching in every current TokenGraph
  guard. Rebinding and transformations must preserve the extra information, not
  reconstruct an accidental scoped/direct default. Existing inference, NoInfer
  unions, opaque boundaries and package authoring gates remain mandatory.
- The model merges registration maps and checks at end; production uses flat
  entry history and incremental admission. The model does not prove production
  performance, error timing, full overloads, complete Module default annotations,
  nontrivial metadata/frames or every erased/union contract.
- Nested ModuleBuilder installation is modeled but is not implemented by the
  current production ModuleBuilder. Only one nesting depth was tested; repeated
  structurally identical capsules and general cycle/identity behavior remain
  unproven. The model uses structural visited sites, not runtime installation IDs.
- Child/shared-scope shape checking is still unresolved. Shared and root services
  retain parent/root dependency bindings; local consumers use child overrides.
  Partial sharing of several module exports can split private consumers between
  those contexts. Eliding topology for all-default-scoped modules is not proved
  safe for this requirement, even if it were safe for captive checking alone.
- There is no lifetime runtime, ownership routing, cancellation, startup, scale,
  actual installed-package or no-skipLibCheck proof in this investigation. The
  candidate cannot complete L1/L2/A1, T2 or any other enterprise acceptance row.

## Local artifacts and reproduction

Full advisory: `/tmp/di-bag-lifetime-carrier-compiled-advisory.md`.
Prototype and complete logs: `/tmp/di-bag-lifetime-probe.7cHKSB`.
`model.ts`, `producer.ts`, `consumer.ts` and `run.mjs` retain the exact experiment;
`results.json`, `raw-negative.log` and `declaration-consumer.log` retain results.
Run `node run.mjs` from that prototype directory to repeat the four phases. The
runner uses file-backed output and regenerates only experiment artifacts/logs.
These are local throwaway files, not a distributed implementation or package API.

Production was read-only throughout the probe and independent rerun. No package
was installed by the probe, no external runtime was executed, and no policy or
representation was silently adopted. The next design must resolve the stated
integration and scope-context gaps before an executable lifetime plan is selected.
