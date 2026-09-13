// Parallel-modules agent eval: sandboxes, agent commands, merge, scoring.
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { closeSync, cpSync, existsSync, mkdirSync, mkdtempSync, openSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const evalRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const repoRoot = resolve(evalRoot, '../..');
export const modules = ['catalog', 'inventory', 'checkout', 'notifications'];
// What `npm install -D typescript @types/node` gives a consumer on the Node line CI pins.
export const toolchain = { typescript: '7.0.2', typesNode: '24' };

const skeleton = join(evalRoot, 'skeleton');
const hidden = join(evalRoot, 'hidden');
const outputLimit = 6000;
const checkTimeoutMs = 300_000;
const placeholders = ['sandbox', 'task', 'module', 'transcript'];
// An enclosing `node --test` would otherwise capture the reports of nested test runs.
const { NODE_TEST_CONTEXT, ...baseEnv } = process.env;
const npmEnv = { ...baseEnv, npm_config_update_notifier: 'false', npm_config_fund: 'false', npm_config_audit: 'false' };

/** Run a process in its own group; kill the group on timeout. Output goes to `log` and is returned truncated. */
export function execute(command, args, { cwd, timeoutMs = checkTimeoutMs, env = baseEnv, log }) {
  return new Promise(done => {
    const started = Date.now();
    const chunks = [];
    const fd = log ? openSync(log, 'w') : undefined;
    const child = spawn(command, args, { cwd, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let timedOut = false;
    const collect = chunk => { chunks.push(chunk); if (fd !== undefined) writeFileSync(fd, chunk); };
    child.stdout.on('data', collect);
    child.stderr.on('data', collect);
    const killGroup = signal => { try { process.kill(-child.pid, signal); } catch {} };
    const timer = setTimeout(() => {
      timedOut = true;
      killGroup('SIGTERM');
      setTimeout(() => killGroup('SIGKILL'), 5000).unref();
    }, timeoutMs);
    let finished = false;
    const finish = (exitCode, signal, error) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      killGroup('SIGKILL'); // stragglers the command left running
      if (fd !== undefined) closeSync(fd);
      const output = Buffer.concat(chunks).toString('utf8') + (error ? `\n${error.message}` : '');
      done({ exitCode, signal, timedOut, durationMs: Date.now() - started, output });
    };
    child.on('error', error => finish(null, null, error));
    child.on('close', (code, signal) => finish(code, signal));
  });
}

const truncate = text => text.length > outputLimit ? `${text.slice(0, outputLimit)}\n[truncated; see the log]` : text;

async function mustRun(command, args, options) {
  const result = await execute(command, args, options);
  if (result.exitCode !== 0) throw new Error(`${command} ${args.join(' ')} failed in ${options.cwd}:\n${result.output}`);
  return result.output;
}

/** Build and pack this checkout; returns the tarball path. */
export async function packLibrary(destination) {
  mkdirSync(destination, { recursive: true });
  await mustRun('npm', ['run', 'build'], { cwd: repoRoot, env: npmEnv });
  const packed = JSON.parse(await mustRun('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', destination], { cwd: repoRoot, env: npmEnv }));
  return join(destination, packed[0].filename);
}

async function installTemplate(dir, tarball) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'package.json'), '{ "private": true, "type": "module" }\n');
  await mustRun('npm', ['install', '--prefer-offline', '--no-package-lock', '--ignore-scripts', resolve(tarball),
    `typescript@${toolchain.typescript}`, `@types/node@${toolchain.typesNode}`], { cwd: dir, env: npmEnv, timeoutMs: 600_000 });
  const version = name => JSON.parse(readFileSync(join(dir, 'node_modules', name, 'package.json'), 'utf8')).version;
  return {
    dir,
    package: { name: 'di-bag', version: version('di-bag'), agentDocs: existsSync(join(dir, 'node_modules/di-bag/AGENTS.md')) },
    typescript: version('typescript'),
    typesNode: version('@types/node'),
  };
}

// Skeleton files every project starts from; module directories are added per sandbox.
function copyBase(dest, template) {
  const features = join(skeleton, 'src', 'features');
  cpSync(skeleton, dest, { recursive: true, filter: source => source !== features && source !== join(skeleton, 'TASK.md') });
  mkdirSync(join(dest, 'src', 'features'), { recursive: true });
  const pkg = JSON.parse(readFileSync(join(skeleton, 'package.json'), 'utf8'));
  pkg.dependencies = { 'di-bag': template.package.version };
  pkg.devDependencies = { '@types/node': template.typesNode, typescript: template.typescript };
  writeFileSync(join(dest, 'package.json'), `${JSON.stringify(pkg, null, 2)}\n`);
  cpSync(join(template.dir, 'node_modules'), join(dest, 'node_modules'), { recursive: true, verbatimSymlinks: true });
}

/** A sandbox holds the owned module directories in full and only `contract.ts` of the others. */
export function prepareSandbox(dest, template, owned) {
  copyBase(dest, template);
  for (const name of modules) {
    const target = join(dest, 'src', 'features', name);
    if (owned.includes(name)) {
      cpSync(join(skeleton, 'src', 'features', name), target, { recursive: true });
    } else {
      mkdirSync(target, { recursive: true });
      cpSync(join(skeleton, 'src', 'features', name, 'contract.ts'), join(target, 'contract.ts'));
    }
  }
  if (owned.length === modules.length) cpSync(join(skeleton, 'TASK.md'), join(dest, 'TASK.md'));
}

function listFiles(root, dir = root, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) listFiles(root, path, files);
    else if (entry.isFile()) files.push(relative(root, path));
  }
  return files;
}

function snapshot(root) {
  return new Map(listFiles(root).map(file => [file, createHash('sha1').update(readFileSync(join(root, file))).digest('hex')]));
}

function changesOutside(before, after, owned) {
  const allowed = owned.map(name => `src/features/${name}/`);
  const changes = [];
  for (const [file, hash] of after) {
    if (!before.has(file)) changes.push(`A ${file}`);
    else if (before.get(file) !== hash) changes.push(`M ${file}`);
  }
  for (const file of before.keys()) if (!after.has(file)) changes.push(`D ${file}`);
  return changes.filter(change => !allowed.some(prefix => change.slice(2).startsWith(prefix))).sort();
}

const shellQuote = value => `'${String(value).replaceAll("'", "'\\''")}'`;

/** Replace `{sandbox}`, `{task}`, `{module}`, `{transcript}` with shell-quoted values. */
export function fillTemplate(template, values) {
  return template.replace(new RegExp(`\\{(${placeholders.join('|')})\\}`, 'g'), (_, key) => shellQuote(values[key]));
}

/** Optional transcript contract: a JSON object with a non-negative integer `iterations`. */
export function readTranscript(path) {
  if (!existsSync(path)) return { iterations: null, transcript: null };
  try {
    const transcript = JSON.parse(readFileSync(path, 'utf8'));
    if (typeof transcript !== 'object' || transcript === null || Array.isArray(transcript)) throw new Error('not a JSON object');
    if (!Number.isInteger(transcript.iterations) || transcript.iterations < 0) throw new Error('iterations must be a non-negative integer');
    return { iterations: transcript.iterations, transcript };
  } catch (error) {
    return { iterations: null, transcript: null, transcriptError: `${path}: ${error.message}` };
  }
}

async function runAgent({ id, owned, sandbox, work, agentCommand, timeoutMs }) {
  const task = owned.length === modules.length ? join(sandbox, 'TASK.md') : join(sandbox, 'src', 'features', id, 'TASK.md');
  const transcript = join(work, 'transcripts', `${id}.json`);
  const values = { sandbox, task, module: id, transcript };
  const before = snapshot(sandbox);
  const env = { ...baseEnv, AGENT_EVAL_SANDBOX: sandbox, AGENT_EVAL_TASK: task, AGENT_EVAL_MODULE: id, AGENT_EVAL_TRANSCRIPT: transcript };
  const run = await execute('sh', ['-c', fillTemplate(agentCommand, values)], { cwd: sandbox, env, timeoutMs, log: join(work, 'logs', `agent-${id}.log`) });
  return {
    id, modules: owned, exitCode: run.exitCode, signal: run.signal, timedOut: run.timedOut, durationMs: run.durationMs,
    ...readTranscript(transcript),
    outsideChanges: changesOutside(before, snapshot(sandbox), owned),
  };
}

function check(run, extra = {}) {
  return { ok: run.exitCode === 0 && !run.timedOut, exitCode: run.exitCode, timedOut: run.timedOut, durationMs: run.durationMs, ...extra, output: truncate(run.output) };
}

function tapCounts(output) {
  const count = name => Number(output.match(new RegExp(`^# ${name} (\\d+)$`, 'm'))?.[1] ?? 0);
  return { pass: count('pass'), fail: count('fail') };
}

/** Merge every module directory into a fresh project and score it. */
export async function scoreMerge({ work, template, sources }) {
  const merged = join(work, 'merged');
  copyBase(merged, template);
  for (const name of modules) cpSync(join(sources[name], 'src', 'features', name), join(merged, 'src', 'features', name), { recursive: true });
  for (const name of modules) {
    cpSync(join(hidden, 'tests', `${name}.test.ts`), join(merged, 'eval-hidden', 'tests', `${name}.test.ts`));
    cpSync(join(hidden, 'checks', `${name}.check.ts`), join(merged, 'eval-hidden', 'checks', `${name}.check.ts`));
    writeFileSync(join(merged, 'eval-hidden', 'checks', `${name}.tsconfig.json`), `${JSON.stringify({
      extends: '../../tsconfig.json', include: [`../../src/features/${name}`, `${name}.check.ts`],
    }, null, 2)}\n`);
  }
  const logs = join(work, 'logs');
  const tsc = join(merged, 'node_modules', '.bin', 'tsc');
  const nodeTest = (target, log) => execute(process.execPath,
    ['--import', './resolve-ts.mjs', '--test', '--test-reporter=tap', '--test-timeout=30000', target], { cwd: merged, log });

  const typecheck = check(await execute(tsc, ['--noEmit', '--pretty', 'false', '-p', 'tsconfig.json'], { cwd: merged, log: join(logs, 'typecheck.log') }));
  const testsRun = await nodeTest('src/**/*.test.ts', join(logs, 'project-tests.log'));
  const projectTests = check(testsRun, tapCounts(testsRun.output));
  const results = {};
  for (const name of modules) {
    const isolated = check(await execute(tsc, ['--noEmit', '--pretty', 'false', '-p', `eval-hidden/checks/${name}.tsconfig.json`],
      { cwd: merged, log: join(logs, `isolated-${name}.log`) }));
    const hiddenRun = await nodeTest(`eval-hidden/tests/${name}.test.ts`, join(logs, `hidden-${name}.log`));
    const counts = tapCounts(hiddenRun.output);
    const hiddenTests = { ...check(hiddenRun, counts), ok: check(hiddenRun).ok && counts.fail === 0 && counts.pass > 0 };
    const dir = join(merged, 'src', 'features', name);
    const layout = {
      checkTs: existsSync(join(dir, 'check.ts')),
      tests: readdirSync(dir).some(file => file.endsWith('.test.ts')),
      contractChanged: readFileSync(join(dir, 'contract.ts'), 'utf8') !== readFileSync(join(skeleton, 'src', 'features', name, 'contract.ts'), 'utf8'),
    };
    results[name] = { isolated, hiddenTests, layout };
  }
  const success = typecheck.ok && projectTests.ok && modules.every(name => results[name].isolated.ok && results[name].hiddenTests.ok);
  return { merged, success, typecheck, projectTests, modules: results };
}

/**
 * Run the eval once. `mode` is 'parallel' (one agent command per module) or 'baseline' (one for all).
 * Returns the result object and writes it to `<workDir>/result.json`.
 */
export async function runEval({ mode = 'parallel', agentCommand, timeoutSeconds = 1800, packagePath, workDir, log = () => {} }) {
  if (typeof agentCommand !== 'string' || agentCommand.trim() === '') throw new Error('an agent command is required');
  if (mode !== 'parallel' && mode !== 'baseline') throw new Error(`unknown mode: ${mode}`);
  const parent = workDir ?? tmpdir();
  mkdirSync(parent, { recursive: true });
  const work = mkdtempSync(join(parent, 'di-bag-agent-eval-'));
  for (const dir of ['logs', 'transcripts', 'sandboxes']) mkdirSync(join(work, dir));
  log(`work directory: ${work}`);

  const tarball = packagePath ? resolve(packagePath) : await packLibrary(join(work, 'pack'));
  log(`package: ${tarball}`);
  const template = await installTemplate(join(work, 'template'), tarball);
  if (!template.package.agentDocs) log('warning: the package ships no AGENTS.md');

  const plan = mode === 'parallel' ? modules.map(name => ({ id: name, owned: [name] })) : [{ id: 'all', owned: modules }];
  for (const { id, owned } of plan) prepareSandbox(join(work, 'sandboxes', id), template, owned);
  log(`running ${plan.length} agent command(s), timeout ${timeoutSeconds} s`);
  const timeoutMs = Math.round(timeoutSeconds * 1000);
  const agents = await Promise.all(plan.map(({ id, owned }) =>
    runAgent({ id, owned, sandbox: join(work, 'sandboxes', id), work, agentCommand, timeoutMs })));

  log('merging and scoring');
  const sources = Object.fromEntries(plan.flatMap(({ id, owned }) => owned.map(name => [name, join(work, 'sandboxes', id)])));
  const merge = await scoreMerge({ work, template, sources });
  const result = {
    schema: 1,
    mode,
    date: new Date().toISOString(),
    workDir: work,
    package: template.package,
    toolchain: { node: process.version, typescript: template.typescript, typesNode: template.typesNode },
    agentCommand,
    timeoutSeconds,
    agents,
    merge,
    success: merge.success,
  };
  writeFileSync(join(work, 'result.json'), `${JSON.stringify(result, null, 2)}\n`);
  return result;
}
