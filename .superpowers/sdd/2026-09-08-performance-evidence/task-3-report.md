# Task 3: baseline comparison and controlled-runner verdicts

Implemented reproducible intrinsic-baseline construction from `git archive
739b509`, including exact commit/tree/source-archive/lockfile identities and
Node/npm/TypeScript/Git/tar identities. Current and baseline archives are
installed offline into separate consumers and execute the same copied scenario
fixture and child protocol.

For each scenario/count, warmups and samples run serially in pairs. A stable
seed selects the first orientation and each subsequent pair reverses it. Every
child execution is appended to a clone-safe journal before validation. Each
implementation retains exactly 31 samples; summaries and the deterministic
10,000-resample paired-bootstrap interval follow the raw records.

The verdict is `review` only when the dedicated controlled-runner marker is
present and median ratio is at least 1.15, p95 ratio is at least 1.20, and the
paired-bootstrap interval lower bound exceeds 1.10. Such a row retains
`confirmationRequired: true`. Ordinary hosts always return `informational`.

Evidence at implementation SHA `8ee869616229ec54a547c4b980d96fc0c5a4e9ad`:

- Seed 17: 14 informational rows; 868 measured and 140 warmup children.
- Seed 29: 14 informational rows; 868 measured and 140 warmup children.
- Each journal contains 1 run header, 1,008 child records, and 14 summaries.
- Independent journal validation confirmed 14 scenario/count groups, serial
  sequence 0–71 per group, exact seeded alternation, slots 0–30 in each lane,
  validated summary schemas, and no transient `/tmp/di-bag-*` paths.
- Focused baseline/protocol suite: 32 pass, 0 fail, 244 assertions after review
  fixes.
- Classic typecheck and build: pass.
- Native installed-package gate: 2 pass, 0 fail, 1,152 assertions.

These ordinary-machine measurements support no universal speed claim. No row
is described as a regression.

Independent review found that unavailable/fail terminal outcomes were not
journaled and that the first comparison validator trusted supplied summary and
verdict arithmetic. Regression tests now require terminal records. The final
validator recomputes summaries, paired-bootstrap intervals, ratios, predicates,
and controlled-runner eligibility from the raw samples. It strictly revalidated
all 28 retained summaries.
