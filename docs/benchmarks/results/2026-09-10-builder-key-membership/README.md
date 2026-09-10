# Builder membership from finite key sets

Candidate `e8c7eac0811358e698e7ddb609e25a1c358607fd` replaces full registration-map
reconstruction at Builder membership checks with exact entry keys. Broad string
histories retain reconstruction because their numeric-index behavior differs.
The graph, output and retained-consumer checks stay in place. Existing public
helper definitions also remain unchanged to preserve extracted method views.

The three tightened work regressions fail on base `405e814` and pass on the
candidate. A public broad-history numeric-duplicate characterization rejects the
discarded direct-key shortcut and passes on the candidate. Source tests (123),
package/declaration tests (96), both typechecks, all 639 native diagnostic regions
and documentation checks pass. Raw logs are retained beside this report.

Independent review found no issues requiring fixes. Its additional probes preserve generic forwarding and reflected parameters across 17 unusual histories. Some rejected-program diagnostic text can use different helper names or ellipsis formatting; there is no claim of universal byte-identical error text. Final original scale results follow.

## Investigation evidence

The experiments directory contains exploratory in-memory classic compiler
comparisons and copied-source native probes. They use the original generators;
they do not replace final committed-source acceptance rows. The source and fixture
base is `405e814`, whose full tree is identical to preceding tested head `47eb8f3`.
Reproduce historical fixture comparisons against that base; the candidate adds
one positive broad-history characterization afterward.

Initial inverse requirement maps did not help. Moving output context into the
registration parameter reduced work but changed contracts, so those variants
were discarded. Direct entry keys reduce work but omit implicit numeric keys in
broad string histories; the final helper preserves the full-map fallback.
Retaining original helper definitions avoids changes to extracted alias method
renderings. The final prototype comparison preserves all 642 raw fixture
diagnostic records and all 668 positive variable type renderings. These are
comparison counts from a combined Program, not an assertion that deliberately
negative fixtures have zero diagnostics.

The original native 1,000-replacement probe still exceeded memory with the earlier
replacement-key-only prototype. The broader direct-key prototype still reported
TS2589 for 1,000 token bindings despite reduced work. Those prototypes are not the
final candidate, and neither is an accepted large-case result. A generated
key-equivalence script initially had a syntax error; its original source/output
are retained separately from the corrected passing run.

## Original scale results

The serial collection completed all 24 cases on clean, pinned baseline and
candidate commits, using unchanged original generators and limits: 60 seconds,
3,072 MiB memory, 4 MiB output, default stacks. Versions were Bun 1.4.0,
TypeScript 6.0.3 and native TypeScript 7.0.2. All 16 paired 500-operation cases
passed. The eight candidate 1,000-operation cases still failed.

| 500-operation form | Classic instantiations, before → after | Native instantiations, before → after |
| --- | ---: | ---: |
| chained | 15,908,032 → 14,782,360 (−7.08%) | 15,893,128 → 14,767,400 (−7.08%) |
| replacement | 30,203,551 → 27,951,123 (−7.46%) | 30,189,436 → 27,936,952 (−7.46%) |
| bindings | 27,268,340 → 26,136,168 (−4.15%) | 27,216,319 → 26,084,086 (−4.16%) |
| modules | 40,084,422 → 38,959,250 (−2.81%) | 40,071,779 → 38,946,551 (−2.81%) |

Memory does not show a general improvement. Classic peak RSS for named,
replacement, binding and module cases changed from 1,883/2,111/2,146/2,190 MiB
to 1,797/2,158/2,097/2,187 MiB. Native sampled peaks changed from
676.29/1,086.20/882.64/1,027.85 MiB to 689.24/1,145.90/905.55/1,034.32 MiB.
Native reported compiler memory was essentially unchanged. These are single
process observations; timings and memory do not establish a statistical trend.

| Original 1,000-operation form | Classic result | Native result |
| --- | --- | --- |
| chained | compiler stack overflow | timeout |
| replacement | compiler stack overflow | memory |
| bindings | worker timeout | TS2589 |
| modules | worker timeout | memory |

All eight failures remain open. Lower instantiation counts do not turn TS2589,
stack errors, timeouts or memory terminations into accepted rows. This change
does not complete the larger compiler scaling goal.

`measurements/rows.jsonl` contains every raw row; `measurements/summary.json`
contains the verified comparisons. `measurements/manifest.json` pins the source
files and commits, and `collection-completed.json` records collection completion.
The collector and summarizer retain original absolute experiment paths; recreate
those checkouts or adjust path constants when reproducing. The artifact checksum
manifest covers each retained file except itself. Hosted CI runs on the later
evidence-only commit; its production, tests, generator and package inputs match
the reviewed candidate above.
