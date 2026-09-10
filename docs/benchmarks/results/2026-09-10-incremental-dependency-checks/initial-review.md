**Review decision: the supplied `cached-finite.ts` has one blocking public generic regression. Do not adopt that exact snapshot. The separate bottom-key-guarded variant is suitable for production validation; it is not yet merge-ready.**

Reviewed baseline production commit `e8c7eac0811358e698e7ddb609e25a1c358607fd` against `/tmp/di-bag-empty-dependency-probe/cached-finite.ts`. The baseline source snapshots match that commit byte-for-byte. The two builder snapshots are identical. Repository HEAD stayed at `a33dcd339bd90aa1944bfda18a4c75952b70d167`, and `git status --short` was empty. The repository, index, branch, and original experiment files were not changed by this review.

**P1 — cached retained token requirements reject a previously valid generic binding.** At candidate `types.ts:120`, `WrongToken<RetainedTokenNeeds<...>, N>` can remain deferred even when the history key is statically `never`. The per-entry baseline reduces this case to `never` before it needs to inspect the generic registration. The new helper does not provide the same reduction during generic function checking. This breaks the stated public generic/manual-history compatibility requirement; it is not just a diagnostic rendering difference.

The minimal public API reproducer is:

```ts
import { DiBag, type Builder, type Registration } from '../src';

const key = Symbol('service');
const token = DiBag.token(key).of<number>();

export function bindAfterBottomKey<R extends Registration>(
  builder: Builder<{ key: never; registration: R }>,
) {
  return builder.bind(token, () => 1);
}
```

Under the installed classic compiler (`6.0.3`), the baseline produces zero diagnostics. The supplied candidate produces TS2345 on the registration argument, with its unresolved `WrongToken<RetainedTokenNeeds<{ key: never; registration: R }>, ...>` in the expected parameter type. A second reproducer using `R extends NeedA` has the same regression. The broader generic probe has 38 baseline rejection locations and 40 candidate locations; these are the only two newly rejected locations. All 62 rendered function return types match.

Evidence and reproduction files are in `/tmp/di-bag-dependency-shortcuts-review/`: `minimal.ts`, `minimal.mjs`, `minimal-baseline.json`, `minimal-cached-finite.json`, `generics.mjs`, `generics-baseline.json`, and `generics-cached-finite.json`. Run a probe from `/tmp/di-bag-replacement-spike`, for example:

```sh
flock -w 55 /tmp/di-bag-compiler-heavy.lock timeout 55s node --max-old-space-size=3072 /tmp/di-bag-dependency-shortcuts-review/minimal.mjs cached-finite
```

The runner supplies virtual source files through the compiler host; it does not rewrite repository files.

**Validated repair direction.** The new, separate snapshot `/tmp/di-bag-dependency-shortcuts-review/cached-finite-bottom-guard.ts` adds one non-distributive key check to the cached incoming-symbol branch:

```ts
    : [E['key']] extends [never] ? never
      : WrongToken<RetainedTokenNeeds<
          [E['key'] & keyof N] extends [never]
            ? E : Exclude<E, { key: keyof N }>
        >, N>;
```

This check follows the existing `string extends E['key']` fallback, so broad string and `any` histories still take the original per-entry branch. The named-incoming branch stays unchanged. In fresh probes, the guard restores the minimal reproducer to zero diagnostics. The generic suite returns to the same 38 rejection locations and diagnostic codes as the baseline, with identical 62 return types. Eight already-rejected generic calls render the cached helper differently in their error text; none changes admission or the failing argument location. Detailed comparisons are recorded in `generics-bottom-guard.json` and `summary.json`.

The conservative existing `new-and-disjoint.ts` snapshot also preserves the entire generic suite: all 38 raw diagnostics and all 62 return types match the baseline exactly. Its results are in `generics-new-and-disjoint.json`. This offers a smaller alternative if the guarded cache does not justify its cost during production validation.

**No further concrete semantic differences found.** The original candidate and the guarded variant each pass a fresh comparison of 131 history types × 29 incoming maps = 3,799 tuples. A single compiler program contains both baseline and candidate helper definitions, sharing the same provider and token identities. Each pair is checked for mutual type assignability across six tuple elements: old token errors, new token errors, new named errors, admission, error-detail tokens, and the branded error message. Both comparisons have zero compiler diagnostics and zero assignability differences. This is stronger evidence than comparing rendered alias names alone, but does not constitute a proof for every unresolved generic program.

The matrix extends the existing histories with optional token requirements, `any` and `never` registrations, `any` token requirements, `never` graphs, broad symbol keys, branded strings, template keys, key unions, registration unions/intersections, opaque contracts mixed with concrete needs, replaced entries, optional incoming properties, symbol index signatures, and union incoming maps. Probe and output files are `compare.mjs`, `comparison-focused.json`, and `comparison-bottom-guard.json`.

The two previously unexplained results, `p_13_7` and `p_13_8`, are semantically equivalent. The baseline retains the spelling `WrongToken<TokenBase | A, ...>`; the candidate expands it to `typeof a | 'opaque token contract'`. In both cases, baseline and candidate tuples are mutually assignable, admission is `false`, token details retain both union members, and the error message is `token dependency has an incompatible or opaque contract`. These alias-rendering differences are not findings.

The existing 124-fixture artifacts were also independently compared: the baseline and supplied candidate have identical 642 raw diagnostics and 669 rendered positive variable types. Those artifacts did not cover the newly discovered generic never-key case. The concrete shortcut reasoning otherwise holds in the reviewed cases: an empty selected key set makes both named `Pick` operands empty; the disjoint-key projection shortcut preserves reconstructed registrations; and distributed `WrongToken` preserves the union of retained concrete and opaque token errors when it is evaluated. The earlier `any` admission failure remains correctly protected by the broad-string fallback. Do not replace that fallback with the previously failed numeric-intersection `IsAny` guard.

**Conditions before adoption.** Add the minimal generic binding to positive production fixtures, retain the `any`-key and opaque/concrete error-detail regressions, and validate the guarded source through the full classic/native contracts, package/build checks, and the required compiler-work ceilings. This review does not verify runtime/package gates, native generic behavior, or performance of the guarded snapshot. The earlier no-fallback 500-binding reduction and remaining native-1000 TS2589 failure do not establish the final candidate's performance or resource compliance. Resource limits must remain unchanged.

All new compiler probes used `/tmp/di-bag-compiler-heavy.lock` and a 55-second per-process timeout with `--max-old-space-size=3072`. Artifact hashes and the changed generic error renderings are recorded in `summary.json`. The reviewed original candidate SHA-256 is `3f1c467df57fa1f560139d1695a7833ef1c6378896f5a9356f3776409415faae`.
