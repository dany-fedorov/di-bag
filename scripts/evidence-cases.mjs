// scripts/evidence-cases.mjs
// Runs the compile-budget cases of docs/superpowers/plans/2026-09-21-00-swift-api-style-master.md
// ("Evidence") one after another, each in a fresh Node process, and prints a Markdown table.
//
//   node scripts/evidence-cases.mjs                                   run the twelve cases
//   node scripts/evidence-cases.mjs --compare <baseline.md>           add baseline and change columns; exit 1 over budget
//   node scripts/evidence-cases.mjs --counts 100                      run only the 100-operation cases
//   node scripts/evidence-cases.mjs --json <rows.json>                also save the raw rows
//   node scripts/evidence-cases.mjs --rows <rows.json> [--compare …]  render saved rows instead of running anything
//
// A case may grow by at most 10% over its baseline. Instantiation counts are deterministic;
// milliseconds and memory are recorded for information only.
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { arch, cpus, release, totalmem, type as osType } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const budgetPercent = 10;
const namedForms = ['bulk', 'chained', 'grouped', 'replacement'];
const tokenForms = ['bindings', 'modules'];
const allowedCounts = [100, 500];

function fail(message) {
  console.error(message);
  process.exit(2);
}

function parseArguments(argv) {
  const options = { compare: undefined, rows: undefined, json: undefined, counts: allowedCounts, root: resolve(dirname(fileURLToPath(import.meta.url)), '..') };
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (value === undefined) fail(`usage: node scripts/evidence-cases.mjs [--compare <baseline.md>] [--counts 100,500] [--json <file>] [--rows <file>] [--root <dir>]`);
    if (flag === '--compare') options.compare = value;
    else if (flag === '--rows') options.rows = value;
    else if (flag === '--json') options.json = value;
    else if (flag === '--root') options.root = resolve(value);
    else if (flag === '--counts') {
      options.counts = value.split(',').map(Number);
      if (!options.counts.length || options.counts.some(count => !allowedCounts.includes(count))) fail('--counts accepts 100, 500 or 100,500');
    } else fail(`unknown argument: ${flag}`);
  }
  return options;
}

/** The cases in the order of the master plan: per count, the named forms, then the token forms. */
function evidenceCases(counts) {
  return counts.flatMap(count => [
    ...namedForms.map(form => ({ form, count, argv: ['scripts/benchmark-types.ts', '--worker', String(count), form, 'valid'] })),
    ...tokenForms.map(form => ({ form, count, argv: ['scripts/check-token-scale.ts', form, 'valid', String(count)] })),
  ]);
}

function runCase(root, item) {
  // The workers are TypeScript files that Node strips; never run them with the Bun that may be running this script.
  const node = process.versions.bun ? 'node' : process.execPath;
  const result = spawnSync(node, ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', ...item.argv], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 10 * 60 * 1000 });
  const failure = result.error ? String(result.error) : result.status !== 0 ? `exit ${result.status ?? result.signal}: ${result.stderr.trim().split('\n').at(-1) ?? ''}` : undefined;
  if (failure) return { form: item.form, count: item.count, accepted: false, failure };
  let row;
  try { row = JSON.parse(result.stdout.trim().split('\n').at(-1) ?? ''); }
  catch { return { form: item.form, count: item.count, accepted: false, failure: 'the worker did not print a JSON row' }; }
  // The named worker reports `accepted`; the token worker reports only its diagnostics.
  const accepted = typeof row.accepted === 'boolean' ? row.accepted : Array.isArray(row.diagnostics) && row.diagnostics.length === 0;
  const validInstantiations = Number.isSafeInteger(row.instantiations) && row.instantiations > 0;
  return {
    form: item.form, count: item.count, instantiations: row.instantiations, milliseconds: row.milliseconds, maxRssMiB: row.maxRssMiB,
    accepted: accepted && validInstantiations,
    failure: !accepted ? 'worker rejected the case' : !validInstantiations ? 'worker reported invalid instantiations' : undefined,
    typescript: row.typescript, node: row.node,
  };
}

/** Read `| form | count | instantiations | …` rows from the first evidence table of a Markdown file. */
function readBaseline(path) {
  const baseline = new Map();
  let inTable = false;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (/^\|\s*Case\s*\|\s*Count\s*\|\s*Instantiations\s*\|/.test(line)) { inTable = true; continue; }
    if (!inTable) continue;
    if (!line.startsWith('|')) { if (baseline.size) break; continue; }
    const cells = line.split('|').slice(1, -1).map(cell => cell.trim());
    const instantiations = Number((cells[2] ?? '').replaceAll(',', ''));
    if (/^\d+$/.test(cells[1] ?? '') && Number.isSafeInteger(instantiations) && instantiations > 0) baseline.set(`${cells[0]}@${cells[1]}`, instantiations);
  }
  if (!baseline.size) fail(`${path} has no evidence table (a header row starting with "| Case | Count | Instantiations |")`);
  return baseline;
}

const number = value => (Number.isFinite(value) ? value.toLocaleString('en-US') : 'n/a');
const percent = value => `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;

function render(rows, baseline, expectedCases) {
  const problems = [];
  const seen = new Set();
  for (const [index, row] of rows.entries()) {
    const id = `${row?.form} ${row?.count}`;
    const key = `${row?.form}@${row?.count}`;
    if (typeof row?.accepted !== 'boolean') problems.push(`${id}: accepted must be a boolean`);
    if (seen.has(key)) problems.push(`${id}: duplicate saved row`);
    seen.add(key);
    if (row?.accepted === true && (!Number.isSafeInteger(row.instantiations) || row.instantiations <= 0)) {
      problems.push(`${id}: instantiations must be a positive safe integer`);
    }
    if (baseline && typeof row?.form !== 'string') problems.push(`saved row ${index + 1}: form must be a string`);
    if (baseline && (!Number.isSafeInteger(row?.count) || !allowedCounts.includes(row.count))) {
      problems.push(`saved row ${index + 1}: count must be an allowed integer`);
    }
  }
  if (baseline) {
    const expected = new Set(expectedCases.map(item => `${item.form}@${item.count}`));
    for (const item of expectedCases) {
      if (!seen.has(`${item.form}@${item.count}`)) problems.push(`${item.form} ${item.count}: missing from saved rows`);
    }
    for (const row of rows) {
      if (!expected.has(`${row?.form}@${row?.count}`)) problems.push(`${row?.form} ${row?.count}: unexpected saved row`);
    }
  }
  const header = baseline
    ? ['| Case | Count | Instantiations | Baseline | Change | Milliseconds | Max RSS MiB | Accepted |', '| --- | --- | --- | --- | --- | --- | --- | --- |']
    : ['| Case | Count | Instantiations | Milliseconds | Max RSS MiB | Accepted |', '| --- | --- | --- | --- | --- | --- |'];
  const lines = rows.map(row => {
    const id = `${row.form} ${row.count}`;
    if (!row.accepted) problems.push(`${id}: not accepted${row.failure ? ` (${row.failure})` : ''}`);
    const measured = [number(row.milliseconds), number(row.maxRssMiB), row.accepted ? 'yes' : 'no'];
    if (!baseline) return `| ${row.form} | ${row.count} | ${number(row.instantiations)} | ${measured.join(' | ')} |`;
    const before = baseline.get(`${row.form}@${row.count}`);
    if (before === undefined) problems.push(`${id}: missing from the baseline`);
    const change = before === undefined || !Number.isFinite(row.instantiations) ? undefined : (row.instantiations - before) / before * 100;
    if (change !== undefined && change > budgetPercent) problems.push(`${id}: ${percent(change)} is over the ${budgetPercent}% budget`);
    return `| ${row.form} | ${row.count} | ${number(row.instantiations)} | ${number(before)} | ${change === undefined ? 'n/a' : percent(change)} | ${measured.join(' | ')} |`;
  });
  return { table: [...header, ...lines].join('\n'), problems };
}

function provenance(root, rows) {
  const git = args => spawnSync('git', args, { cwd: root, encoding: 'utf8' }).stdout.trim();
  const commit = git(['rev-parse', '--short', 'HEAD']) || 'unknown commit';
  const dirty = git(['status', '--porcelain', '--', 'src', 'tests', 'scripts']) ? ' with uncommitted changes under src, tests or scripts' : '';
  const first = rows.find(row => row.typescript) ?? {};
  return `Recorded ${new Date().toISOString()} at ${commit}${dirty} on ${osType()} ${release()}, ${arch()}, ${cpus().length} CPUs, ${Math.round(totalmem() / 1024 / 1024).toLocaleString('en-US')} MiB, Node ${first.node ?? process.version}, TypeScript ${first.typescript ?? 'unknown'}.`;
}

const options = parseArguments(process.argv.slice(2));
const rows = options.rows
  ? JSON.parse(readFileSync(options.rows, 'utf8'))
  : evidenceCases(options.counts).map(item => {
    console.error(`running ${item.form} ${item.count} …`);
    return runCase(options.root, item);
  });
if (!Array.isArray(rows)) fail('saved rows must be a JSON array');
const invalidRow = rows.findIndex(row => typeof row !== 'object' || row === null || Array.isArray(row));
if (invalidRow >= 0) fail(`saved row ${invalidRow + 1} must be an object`);
if (options.json) writeFileSync(options.json, `${JSON.stringify(rows, null, 2)}\n`);
const { table, problems } = render(rows, options.compare ? readBaseline(options.compare) : undefined, evidenceCases(options.counts));
console.log(options.rows ? 'Rendered from saved rows.' : provenance(options.root, rows));
console.log('');
console.log(table);
if (problems.length) {
  console.error(`\n${problems.join('\n')}`);
  process.exitCode = 1;
}
