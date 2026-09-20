// tests/evidence-cases.test.ts
import { afterAll, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(__dirname, '..');
const workspace = mkdtempSync(join(tmpdir(), 'di-bag-evidence-'));
afterAll(() => rmSync(workspace, { recursive: true, force: true }));

const rows = [
  { form: 'bulk', count: 100, instantiations: 159001, milliseconds: 1100, maxRssMiB: 366, accepted: true, typescript: '6.0.3', node: 'v24.20.0' },
  { form: 'bindings', count: 500, instantiations: 12152666, milliseconds: 9300, maxRssMiB: 1684, accepted: true, typescript: '6.0.3', node: 'v24.20.0' },
];
const baseline = (bulk: string, bindings: string) => [
  '# Baseline', '', 'Some prose.', '',
  '| Case | Count | Instantiations | Milliseconds | Max RSS MiB | Accepted |', '| --- | --- | --- | --- | --- | --- |',
  `| bulk | 100 | ${bulk} | 1,000 | 364 | yes |`, `| bindings | 500 | ${bindings} | 9,300 | 1,684 | yes |`, '', 'More prose.', '',
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

test('renders saved rows as a table without a baseline', () => {
  const result = run('--rows', write('rows.json', JSON.stringify(rows)));
  expect(result.status).toBe(0);
  expect(result.stdout).toContain('| Case | Count | Instantiations | Milliseconds | Max RSS MiB | Accepted |');
  expect(result.stdout).toContain('| bulk | 100 | 159,001 | 1,100 | 366 | yes |');
  expect(result.stdout).toContain('| bindings | 500 | 12,152,666 | 9,300 | 1,684 | yes |');
});

test('compares with a baseline table and passes inside the budget', () => {
  const result = run('--rows', write('rows.json', JSON.stringify(rows)), '--compare', write('inside.md', baseline('158,620', '12,152,666')));
  expect(result.status).toBe(0);
  expect(result.stdout).toContain('| bulk | 100 | 159,001 | 158,620 | +0.2% | 1,100 | 366 | yes |');
  expect(result.stdout).toContain('| bindings | 500 | 12,152,666 | 12,152,666 | 0.0% | 9,300 | 1,684 | yes |');
});

test('exits 1 when a case grows by more than ten percent', () => {
  const result = run('--rows', write('rows.json', JSON.stringify(rows)), '--compare', write('over.md', baseline('140,000', '12,152,666')));
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('bulk 100: +13.6% is over the 10% budget');
});

test('exits 1 when a case was rejected, failed to run, or is missing from the baseline', () => {
  const rejected = [{ ...rows[0], accepted: false, failure: 'exit 1: boom' }, rows[1]];
  const result = run('--rows', write('rejected.json', JSON.stringify(rejected)), '--compare', write('partial.md', baseline('158,620', 'n/a')));
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('bulk 100: not accepted (exit 1: boom)');
  expect(result.stderr).toContain('bindings 500: missing from the baseline');
});

test('saves the rows it rendered and rejects unknown arguments', () => {
  const saved = join(workspace, 'saved.json');
  expect(run('--rows', write('rows.json', JSON.stringify(rows)), '--json', saved).status).toBe(0);
  expect(JSON.parse(readFileSync(saved, 'utf8'))).toEqual(rows);
  const unknown = run('--wat', 'x');
  expect(unknown.status).toBe(2);
  expect(unknown.stderr).toContain('unknown argument: --wat');
});
