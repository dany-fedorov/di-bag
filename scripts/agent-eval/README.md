# Agent eval

Measures whether coding agents that see only the installed `di-bag` package,
its shipped agent docs, and one module directory can build modules in parallel
that merge cleanly. It is step L8 "Eval" of
`docs/superpowers/specs/2026-09-13-agent-friendly-loop.md`.

The maintainer runs it by hand before a release and records the result under
`docs/benchmarks/`. It is not a CI gate: every run starts paid agent sessions,
and the scores vary between runs. CI runs only the harness's own tests, which
use a fake agent command.

## Run

Requires Node 24 and npm. The first run downloads `typescript` and
`@types/node` into the npm cache.

```sh
# Parallel: one agent command per module, all at once.
node scripts/agent-eval/run.mjs --agent-command '<template>'

# Baseline: one agent command, one sandbox with every module.
node scripts/agent-eval/run.mjs --agent-command '<template>' --baseline

# Append the run to docs/benchmarks/agent-eval-<date>.json and .md.
node scripts/agent-eval/run.mjs --agent-command '<template>' --record
```

| Option | Meaning |
| --- | --- |
| `--agent-command <template>` | Required. There is no default agent. |
| `--baseline` | Baseline mode. |
| `--timeout <seconds>` | Per agent command; default 1800. |
| `--package <tarball>` | Use a packed `di-bag`; default: build and pack this checkout. |
| `--work-dir <dir>` | Parent of the run directory; default: the OS temp directory. |
| `--record`, `--record-dir <dir>` | Record the run in `docs/benchmarks/` or in `<dir>`. |

Exit status: 0 when the merge passes, 1 when it fails, 2 on a usage or harness
error. The run directory keeps the sandboxes, the merged project, every log,
and `result.json`.

An example to adapt, for Claude Code; check the flags against your installed
version, and see "Isolation" before running it:

```sh
node scripts/agent-eval/run.mjs --timeout 1800 --agent-command \
  'claude -p "$(cat {task})" --permission-mode acceptEdits --output-format json \
     | jq "{iterations: .num_turns, costUsd: .total_cost_usd}" > {transcript}'
```

## Agent command contract

- The template runs with `sh -c`, working directory the sandbox. Placeholders
  are replaced with shell-quoted values: `{sandbox}` (absolute sandbox path),
  `{task}` (its `TASK.md`), `{module}` (module name, or `all` in baseline
  mode), `{transcript}` (where to write the optional transcript). The same
  values are in `AGENT_EVAL_SANDBOX`, `AGENT_EVAL_TASK`, `AGENT_EVAL_MODULE`,
  and `AGENT_EVAL_TRANSCRIPT`.
- Parallel mode starts every module's command at once.
- The command runs in its own process group. At the timeout the group gets
  SIGTERM, then SIGKILL after 5 seconds, and the sandbox is scored as the agent
  left it. Processes still running after the command exits are killed.
- The exit status is recorded, not scored.
- Only `src/features/<module>/` is merged. Other changes are listed as
  "changes outside its modules" and discarded.
- Transcript, optional: a JSON object at `{transcript}` with `iterations`, a
  non-negative integer counting whatever the wrapper defines as an attempt
  (for example model turns). Other fields, such as `model` or `costUsd`, are
  kept in the result. A malformed file is reported and its iterations are not
  counted. The file lives outside the sandbox.

## Isolation

A sandbox is a directory, not a jail. This repository, including the reference
solution and the hidden tests, is readable by any process on the machine. Limit
the agent's file access to the sandbox, with the agent's own permission
settings or a container, or the score measures nothing.

## What an agent sees

```text
<sandbox>/
  package.json              scripts: typecheck, test, check:fast
  tsconfig.json
  resolve-ts.mjs            lets node --test load .ts files imported as .js
  node_modules/             di-bag from the tarball (with AGENTS.md and docs/agent when shipped),
                            typescript, @types/node
  src/app.ts                installs every module, one installModule per line
  src/app.check.ts          the merge check
  src/features/<module>/    contract.ts, stub module.ts, tsconfig.json, TASK.md
  src/features/<other>/     contract.ts only
```

Baseline mode has every module directory in full and a root `TASK.md`. The
task files state the contract and behavior. They do not mention AGENTS.md or
DI Bag conventions such as `check.ts`: discovering those from the package is
part of what is measured.

## Scoring

The merged project is the skeleton plus each sandbox's `src/features/<module>/`
as the agent left it, including a changed `contract.ts`.

| Score | How |
| --- | --- |
| Whole-project type-check | `tsc --noEmit -p tsconfig.json`: `src/app.check.ts`, every `check.ts`, every test file. |
| Project tests | `node --test` over `src/**/*.test.ts`, the tests the agents wrote. |
| Isolated check | Per module, `tsc` over that module's directory plus a hidden check that installs the module with a fixture for exactly its contract's requirements, calls `verifyGraph()`, and asserts the exported types. |
| Hidden tests | Per module, fork-based behavior tests from `hidden/tests/`, copied in only for scoring. |
| Layout | Per module: `check.ts` present, own tests present, contract changed. Reported, not scored. |
| Iterations | From the transcript, when written. |

The merge passes on the first attempt when the type-check, the project tests,
every isolated check, and every hidden test suite pass. There is no retry.

## Cost

A parallel run starts four agent sessions and a baseline run one, each bounded
by the timeout. What that costs depends on the agent and model. Because scores
vary, run each mode more than once and record every run.

## Maintenance

- `skeleton/` follows the module layout in `AGENTS.md`; change them together.
- `reference/` is a correct solution. It is used only by the harness tests,
  which prove it scores full success and that mutated copies fail where they
  should: `npm run agent-eval:test`. When a task, contract, or hidden test
  changes, change the reference with it.
- The TypeScript and `@types/node` versions installed into sandboxes are in
  `lib/harness.mjs`.
