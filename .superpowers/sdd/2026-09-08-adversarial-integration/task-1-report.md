# Task 1: deterministic source matrix

Base SHA: `aef569ff87b53b26c2b16e2befc9f56fb432a007`

The required structural RED was observed first: `bun test tests/final-adversarial-integration.test.ts`
failed because `final-adversarial-runtime-fixture` did not exist. The test and dependency-injected
runtime fixture now exercise I1-I13 and define the complete I1-I15 result oracle.

The matrix found one retained contract RED with no production edit:

```text
error: I12: late cleanup changed: ["late","immediate"]
0 pass
1 fail
```

The expected cancellation sequence is `['immediate', 'late']`. The unmodified cleanup path waits
for pending ownership and then reverses acquisition order in `src/acquisition.ts` `disposeAll()`;
cancellation reaches it from `src/startup.ts`. With only this assertion temporarily bypassed, the
complete I1-I13 source test passed (`1 pass`, `0 fail`). The required assertion was restored after
the probe.

Neighboring source verification remained green:

```text
bun test tests/box-adapters.test.ts tests/plugins.test.ts tests/observers.test.ts tests/startup.test.ts
66 pass
0 fail
384 assertions
```

`npm run typecheck` also exited zero after the fixture was added. The task stops here under the
plan's failure policy so Task 4 can classify and design any production correction.
