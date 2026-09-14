#!/usr/bin/env node
// Hand-run agent eval; see README.md. Exit 0: merge passed, 1: merge failed, 2: usage or harness error.
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { repoRoot, runEval } from './lib/harness.mjs';
import { recordRun, renderRun } from './lib/report.mjs';

const usage = `usage: node scripts/agent-eval/run.mjs --agent-command '<template>' [options]

  --agent-command <template>  required; placeholders {sandbox} {task} {module} {transcript}
  --baseline                  one sandbox with every module and one agent command
  --timeout <seconds>         per agent command (default 1800)
  --package <tarball>         use this packed di-bag instead of packing the checkout
  --work-dir <dir>            parent of the run directory (default: the OS temp directory)
  --record                    append to docs/benchmarks/agent-eval-<date>.{json,md}
  --record-dir <dir>          record into this directory instead`;

let values;
try {
  ({ values } = parseArgs({
    options: {
      'agent-command': { type: 'string' },
      baseline: { type: 'boolean', default: false },
      timeout: { type: 'string', default: '1800' },
      package: { type: 'string' },
      'work-dir': { type: 'string' },
      record: { type: 'boolean', default: false },
      'record-dir': { type: 'string' },
      help: { type: 'boolean', default: false },
    },
  }));
} catch (error) {
  console.error(`${error.message}\n\n${usage}`);
  process.exit(2);
}
if (values.help) {
  console.log(usage);
  process.exit(0);
}
const timeoutSeconds = Number(values.timeout);
if (!values['agent-command'] || !(timeoutSeconds > 0)) {
  console.error(usage);
  process.exit(2);
}

try {
  const result = await runEval({
    mode: values.baseline ? 'baseline' : 'parallel',
    agentCommand: values['agent-command'],
    timeoutSeconds,
    packagePath: values.package,
    workDir: values['work-dir'],
    log: message => console.error(`agent-eval: ${message}`),
  });
  console.log(renderRun(result));
  if (values.record || values['record-dir']) {
    const { markdownPath } = recordRun(result, values['record-dir'] ?? join(repoRoot, 'docs', 'benchmarks'));
    console.error(`agent-eval: recorded ${markdownPath}`);
  }
  console.error(`agent-eval: sandboxes, logs, and result.json are in ${result.workDir}`);
  process.exit(result.success ? 0 : 1);
} catch (error) {
  console.error(`agent-eval: ${error.stack ?? error}`);
  process.exit(2);
}
