// Harness tests with a fake agent command; no model or agent CLI runs.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { evalRoot, fillTemplate, modules, packLibrary, readTranscript, runEval } from '../lib/harness.mjs';
import { recordRun } from '../lib/report.mjs';

const scratch = mkdtempSync(join(tmpdir(), 'di-bag-agent-eval-test-'));
const quote = path => `'${path}'`;
let packagePath;

before(async () => {
  packagePath = await packLibrary(join(scratch, 'pack'));
});
after(() => rmSync(scratch, { recursive: true, force: true }));

const agentCommand = (solution, extra = '') =>
  `node ${quote(join(evalRoot, 'test', 'fake-agent.mjs'))} --solution ${quote(solution)} --sandbox {sandbox} --module {module} --transcript {transcript} ${extra}`;

// A copy of the reference solution with one file edited.
function variant(name, file, edit) {
  const dir = join(scratch, name);
  cpSync(join(evalRoot, 'reference'), dir, { recursive: true });
  const before = readFileSync(join(dir, file), 'utf8');
  const after = edit(before);
  assert.notEqual(after, before, `edit of ${file} changed nothing`);
  writeFileSync(join(dir, file), after);
  return dir;
}

const run = options => runEval({ packagePath, workDir: join(scratch, 'runs'), ...options });

test('the reference solution scores full success', async () => {
  const result = await run({ agentCommand: agentCommand(join(evalRoot, 'reference'), '--iterations 3') });
  assert.equal(result.success, true, JSON.stringify(result.merge, null, 2));
  assert.deepEqual(result.agents.map(agent => [agent.id, agent.exitCode, agent.timedOut, agent.iterations, agent.outsideChanges]),
    modules.map(name => [name, 0, false, 3, []]));
  assert.equal(result.merge.projectTests.pass, 4);
  // Agents see the docs the package ships, and nothing from this repository.
  assert.equal(result.package.agentDocs, true);
  const installed = join(result.workDir, 'sandboxes', 'catalog', 'node_modules', 'di-bag');
  for (const file of ['AGENTS.md', 'docs/agent/recipes.md', 'docs/agent/errors.md']) assert.equal(existsSync(join(installed, file)), true, file);
  assert.equal(existsSync(join(result.workDir, 'sandboxes', 'catalog', 'eval-hidden')), false);
  for (const name of modules) {
    const { isolated, hiddenTests, layout } = result.merge.modules[name];
    assert.equal(isolated.ok, true, name);
    assert.equal(hiddenTests.ok && hiddenTests.fail === 0 && hiddenTests.pass > 0, true, name);
    assert.deepEqual(layout, { checkTs: true, tests: true, contractChanged: false });
  }
  assert.equal(existsSync(join(result.workDir, 'result.json')), true);
});

test('a module that needs a service its contract does not list fails the merge check naming the key', async () => {
  const solution = variant('missing-requirement', 'checkout/module.ts',
    text => text.replace('orderIds: { next(): string };', 'orderIds: { next(): string };\n      clock: { now(): number };'));
  const result = await run({ agentCommand: agentCommand(solution) });
  assert.equal(result.success, false);
  assert.equal(result.merge.typecheck.ok, false);
  assert.match(result.merge.typecheck.output, /required service registrations are missing: clock/);
  assert.equal(result.merge.modules.checkout.isolated.ok, false);
  assert.match(result.merge.modules.checkout.isolated.output, /missing: clock/);
  assert.equal(result.merge.modules.catalog.isolated.ok, true);
});

test('a broken module fails its own isolated check and no other', async () => {
  const solution = variant('broken-module', 'inventory/module.ts',
    text => text.replace('available: sku => ledger.available(sku),', 'available: sku => ledger.available(sku.length),'));
  const result = await run({ agentCommand: agentCommand(solution) });
  assert.equal(result.success, false);
  assert.deepEqual(Object.fromEntries(modules.map(name => [name, result.merge.modules[name].isolated.ok])),
    { catalog: true, inventory: false, checkout: true, notifications: true });
  assert.match(result.merge.modules.inventory.isolated.output, /inventory\/module\.ts/);
});

test('baseline mode runs one agent command over every module and records the run', async () => {
  const result = await run({ mode: 'baseline', agentCommand: agentCommand(join(evalRoot, 'reference'), '--outside') });
  assert.equal(result.success, true, JSON.stringify(result.merge, null, 2));
  assert.equal(result.agents.length, 1);
  assert.deepEqual(result.agents[0].modules, modules);
  assert.equal(result.agents[0].id, 'all');
  assert.equal(result.agents[0].iterations, null);
  assert.deepEqual(result.agents[0].outsideChanges, ['A NOTES.md']);
  assert.equal(existsSync(join(result.workDir, 'sandboxes', 'all', 'TASK.md')), true);

  const records = join(scratch, 'records');
  const { jsonPath, markdownPath } = recordRun(result, records);
  recordRun(result, records);
  const document = JSON.parse(readFileSync(jsonPath, 'utf8'));
  assert.equal(document.runs.length, 2);
  assert.equal('workDir' in document.runs[0], false);
  const markdown = readFileSync(markdownPath, 'utf8');
  assert.match(markdownPath, /agent-eval-\d{4}-\d{2}-\d{2}\.md$/);
  assert.match(markdown, /## baseline run/);
  assert.match(markdown, /Merge passes on the first attempt: yes/);
});

test('an agent command that outlives the timeout is stopped and the sandbox is scored as left', async () => {
  const result = await run({ agentCommand: agentCommand(join(evalRoot, 'reference'), '--sleep 120000'), timeoutSeconds: 1 });
  assert.equal(result.success, false);
  for (const agent of result.agents) {
    assert.equal(agent.timedOut, true, agent.id);
    assert.ok(agent.durationMs < 20_000, `${agent.id} ran ${agent.durationMs} ms`);
  }
  // The stubs are scored: the hidden tests run and fail rather than being skipped.
  assert.equal(result.merge.modules.catalog.hiddenTests.ok, false);
  assert.ok(result.merge.modules.catalog.hiddenTests.fail > 0);
  assert.equal(result.merge.modules.catalog.layout.checkTs, false);
});

test('placeholders are shell-quoted and a malformed transcript is reported, not trusted', () => {
  assert.equal(fillTemplate('run {sandbox} {task} {other}', { sandbox: "/tmp/a b'c", task: 't' }), `run '/tmp/a b'\\''c' 't' {other}`);
  const transcript = join(scratch, 'transcript.json');
  writeFileSync(transcript, '{ "iterations": -1 }');
  assert.deepEqual(readTranscript(transcript).iterations, null);
  assert.match(readTranscript(transcript).transcriptError, /non-negative integer/);
  assert.deepEqual(readTranscript(join(scratch, 'absent.json')), { iterations: null, transcript: null });
});

test('the runner requires an agent command and ships no default', () => {
  const cli = spawnSync(process.execPath, [join(evalRoot, 'run.mjs')], { encoding: 'utf8' });
  assert.equal(cli.status, 2);
  assert.match(cli.stderr, /--agent-command <template>/);
});
