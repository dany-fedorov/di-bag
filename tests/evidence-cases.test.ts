// tests/evidence-cases.test.ts
import { afterAll, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(__dirname, '..');
const workspace = mkdtempSync(join(tmpdir(), 'di-bag-evidence-'));
afterAll(() => rmSync(workspace, { recursive: true, force: true }));

const forms = ['bulk', 'chained', 'grouped', 'replacement', 'bindings', 'modules'];
const rows = [100, 500].flatMap(count => forms.map((form, index) => ({
  form, count, instantiations: count * 1000 + index + 1, milliseconds: 1100, maxRssMiB: 366,
  accepted: true, typescript: '6.0.3', node: 'v24.20.0',
})));
const baseline = (overrides: Record<string, string> = {}) => [
  '# Baseline', '', 'Some prose.', '',
  '| Case | Count | Instantiations | Milliseconds | Max RSS MiB | Accepted |', '| --- | --- | --- | --- | --- | --- |',
  ...rows.map(row => `| ${row.form} | ${row.count} | ${overrides[`${row.form}@${row.count}`] ?? row.instantiations} | 1,000 | 364 | yes |`),
  '', 'More prose.', '',
].join('\n');

function write(name: string, content: string): string {
  const path = join(workspace, name);
  writeFileSync(path, content);
  return path;
}
function run(...args: string[]) {
  // Saved rows keep this test away from the compiler: no case is run.
  return spawnSync(process.execPath, ['scripts/evidence-cases.mjs', ...args], { cwd: root, encoding: 'utf8' });
}
function runWithNode(...args: string[]) {
  return spawnSync('node', ['scripts/evidence-cases.mjs', ...args], { cwd: root, encoding: 'utf8' });
}

test('renders saved rows as a table without a baseline', () => {
  const result = run('--rows', write('rows.json', JSON.stringify(rows)));
  expect(result.status).toBe(0);
  expect(result.stdout).toContain('| Case | Count | Instantiations | Milliseconds | Max RSS MiB | Accepted |');
  expect(result.stdout).toContain('| bulk | 100 | 100,001 | 1,100 | 366 | yes |');
  expect(result.stdout).toContain('| modules | 500 | 500,006 | 1,100 | 366 | yes |');
});

test('compares with a baseline table and passes inside the budget', () => {
  const result = run('--rows', write('rows.json', JSON.stringify(rows)), '--compare', write('inside.md', baseline({ 'bulk@100': '99,800' })));
  expect(result.status).toBe(0);
  expect(result.stdout).toContain('| bulk | 100 | 100,001 | 99,800 | +0.2% | 1,100 | 366 | yes |');
  expect(result.stdout).toContain('| modules | 500 | 500,006 | 500,006 | 0.0% | 1,100 | 366 | yes |');
});

test('exits 1 when a case grows by more than ten percent', () => {
  const result = run('--rows', write('rows.json', JSON.stringify(rows)), '--compare', write('over.md', baseline({ 'bulk@100': '90,000' })));
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('bulk 100: +11.1% is over the 10% budget');
});

test('exits 1 when a case was rejected, failed to run, or is missing from the baseline', () => {
  const rejected = [{ ...rows[0], accepted: false, failure: 'exit 1: boom' }, ...rows.slice(1)];
  const result = run('--rows', write('rejected.json', JSON.stringify(rejected)), '--compare', write('partial.md', baseline({ 'modules@500': 'n/a' })));
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('bulk 100: not accepted (exit 1: boom)');
  expect(result.stderr).toContain('modules 500: missing from the baseline');
});

test('comparison rejects missing and unexpected saved cases for the selected counts', () => {
  const selected = rows.filter(row => row.count === 100);
  const missing = run('--rows', write('missing.json', JSON.stringify(selected.slice(1))), '--counts', '100', '--compare', write('baseline.md', baseline()));
  expect(missing.status).toBe(1);
  expect(missing.stderr).toContain('bulk 100: missing from saved rows');
  const unexpected = run('--rows', write('unexpected.json', JSON.stringify([...selected, rows.at(-1)])), '--counts', '100', '--compare', write('baseline.md', baseline()));
  expect(unexpected.status).toBe(1);
  expect(unexpected.stderr).toContain('modules 500: unexpected saved row');
});

test('comparison rejects duplicate identities and invalid measurements', () => {
  const duplicate = run('--rows', write('duplicate.json', JSON.stringify([...rows, rows[0]])), '--compare', write('baseline.md', baseline()));
  expect(duplicate.status).toBe(1);
  expect(duplicate.stderr).toContain('bulk 100: duplicate saved row');
  for (const instantiations of [undefined, '100001', 0, 1.5]) {
    const malformed = [{ ...rows[0], instantiations }, ...rows.slice(1)];
    const result = run('--rows', write(`malformed-${String(instantiations)}.json`, JSON.stringify(malformed)), '--compare', write('baseline.md', baseline()));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('bulk 100: instantiations must be a positive safe integer');
  }
});

test('saved accepted state is boolean, and comparison identities have valid shapes', () => {
  const nullRow = run('--rows', write('null-row.json', JSON.stringify([null])));
  expect(nullRow.status).toBe(2);
  expect(nullRow.stderr).toContain('saved row 1 must be an object');

  const invalidAccepted = [{ ...rows[0], accepted: 'yes' }, ...rows.slice(1)];
  const rendered = run('--rows', write('invalid-accepted.json', JSON.stringify(invalidAccepted)));
  expect(rendered.status).toBe(1);
  expect(rendered.stderr).toContain('bulk 100: accepted must be a boolean');

  for (const [field, value] of [['form', 1], ['count', '100']] as const) {
    const malformed = [{ ...rows[0], [field]: value }, ...rows.slice(1)];
    const result = run('--rows', write(`malformed-${field}.json`, JSON.stringify(malformed)), '--compare', write('baseline.md', baseline()));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`saved row 1: ${field} must be ${field === 'form' ? 'a string' : 'an allowed integer'}`);
  }
});

test('a worker with an invalid instantiation measurement reports a meaningful failure', () => {
  const fixtureRoot = join(workspace, 'worker-fixture');
  mkdirSync(join(fixtureRoot, 'scripts'), { recursive: true });
  const invalidWorker = `console.log(JSON.stringify({ accepted: true, diagnostics: [], instantiations: 'unknown' }))\n`;
  writeFileSync(join(fixtureRoot, 'scripts/benchmark-types.ts'), invalidWorker);
  writeFileSync(join(fixtureRoot, 'scripts/check-token-scale.ts'), invalidWorker);
  const saved = join(workspace, 'invalid-worker-rows.json');
  const result = runWithNode('--root', fixtureRoot, '--counts', '100', '--json', saved);
  expect(result.status).toBe(1);
  expect(JSON.parse(readFileSync(saved, 'utf8'))[0]).toMatchObject({
    form: 'bulk', count: 100, accepted: false, failure: 'worker reported invalid instantiations',
  });
});

test('saves the rows it rendered and rejects unknown arguments', () => {
  const saved = join(workspace, 'saved.json');
  expect(run('--rows', write('rows.json', JSON.stringify(rows)), '--json', saved).status).toBe(0);
  expect(JSON.parse(readFileSync(saved, 'utf8'))).toEqual(rows);
  const unknown = run('--wat', 'x');
  expect(unknown.status).toBe(2);
  expect(unknown.stderr).toContain('unknown argument: --wat');
});
