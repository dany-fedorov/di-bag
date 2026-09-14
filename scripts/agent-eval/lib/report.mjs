// Markdown summary and the recorded benchmark files.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { modules } from './harness.mjs';

const yes = value => value ? 'yes' : 'no';
const pass = value => value ? 'pass' : 'FAIL';
const seconds = ms => `${Math.round(ms / 1000)} s`;
const cell = text => String(text).replaceAll('|', '\\|').replaceAll('\n', ' ');

function firstLines(output, count = 15) {
  const lines = output.split('\n').filter(line => line.trim() !== '');
  return lines.slice(0, count).join('\n');
}

/** Render one run as Markdown. */
export function renderRun(result) {
  const { merge } = result;
  const lines = [
    `## ${result.mode} run, ${result.date}`,
    '',
    `- Agent command: \`${cell(result.agentCommand)}\``,
    `- Package: ${result.package.name} ${result.package.version}; ships AGENTS.md: ${yes(result.package.agentDocs)}`,
    `- Toolchain: Node ${result.toolchain.node}, TypeScript ${result.toolchain.typescript}, @types/node ${result.toolchain.typesNode}`,
    `- Timeout per agent command: ${result.timeoutSeconds} s`,
    `- **Merge passes on the first attempt: ${yes(result.success)}**`,
    `- Whole-project type-check (src/app.check.ts and every check.ts): ${pass(merge.typecheck.ok)}`,
    `- Project tests: ${pass(merge.projectTests.ok)} (${merge.projectTests.pass} passed, ${merge.projectTests.fail} failed)`,
    '',
    '| Agent | Exit | Timed out | Duration | Iterations | Changes outside its modules |',
    '| --- | --- | --- | --- | --- | --- |',
    ...result.agents.map(agent => `| ${agent.id} | ${agent.exitCode ?? agent.signal} | ${yes(agent.timedOut)} | ${seconds(agent.durationMs)} | ${agent.iterations ?? '-'} | ${cell(agent.outsideChanges.join(', ') || 'none')} |`),
    '',
    '| Module | Isolated check | Hidden tests | check.ts | Own tests | Contract changed |',
    '| --- | --- | --- | --- | --- | --- |',
    ...modules.map(name => {
      const { isolated, hiddenTests, layout } = merge.modules[name];
      return `| ${name} | ${pass(isolated.ok)} | ${pass(hiddenTests.ok)} (${hiddenTests.pass}/${hiddenTests.pass + hiddenTests.fail}) | ${yes(layout.checkTs)} | ${yes(layout.tests)} | ${yes(layout.contractChanged)} |`;
    }),
  ];
  const failures = [
    ['Whole-project type-check', merge.typecheck],
    ['Project tests', merge.projectTests],
    ...modules.flatMap(name => [[`${name} isolated check`, merge.modules[name].isolated], [`${name} hidden tests`, merge.modules[name].hiddenTests]]),
  ].filter(([, entry]) => !entry.ok);
  for (const [title, entry] of failures) lines.push('', `${title}:`, '', '```text', firstLines(entry.output), '```');
  const transcriptErrors = result.agents.filter(agent => agent.transcriptError);
  for (const agent of transcriptErrors) lines.push('', `Transcript error (${agent.id}): ${agent.transcriptError}`);
  return lines.join('\n');
}

function renderDocument(date, runs) {
  return [
    `# Agent eval, ${date}`,
    '',
    'Recorded by `node scripts/agent-eval/run.mjs --record`. The eval is run by hand',
    'and is not deterministic; see `scripts/agent-eval/README.md` for what each column means.',
    '',
    runs.map(renderRun).join('\n\n'),
    '',
  ].join('\n');
}

// Committed records keep the output of failing checks only and no machine-local paths.
function forRecord(result) {
  const trim = entry => entry.ok ? { ...entry, output: '' } : entry;
  const { workDir, ...rest } = result;
  return {
    ...rest,
    merge: {
      success: result.merge.success,
      typecheck: trim(result.merge.typecheck),
      projectTests: trim(result.merge.projectTests),
      modules: Object.fromEntries(Object.entries(result.merge.modules).map(([name, entry]) =>
        [name, { ...entry, isolated: trim(entry.isolated), hiddenTests: trim(entry.hiddenTests) }])),
    },
  };
}

/** Append the run to `<dir>/agent-eval-<date>.json` and regenerate `<dir>/agent-eval-<date>.md`. */
export function recordRun(result, dir) {
  const date = result.date.slice(0, 10);
  mkdirSync(dir, { recursive: true });
  const jsonPath = join(dir, `agent-eval-${date}.json`);
  const markdownPath = join(dir, `agent-eval-${date}.md`);
  const document = existsSync(jsonPath) ? JSON.parse(readFileSync(jsonPath, 'utf8')) : { runs: [] };
  document.runs.push(forRecord(result));
  writeFileSync(jsonPath, `${JSON.stringify(document, null, 2)}\n`);
  writeFileSync(markdownPath, renderDocument(date, document.runs));
  return { jsonPath, markdownPath };
}
