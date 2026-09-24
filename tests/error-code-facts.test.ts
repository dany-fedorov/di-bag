import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const script = resolve(__dirname, '../scripts/error-code-facts.mjs');
const tree = resolve(__dirname, 'fixtures/error-code-facts');
const run = (...codes: string[]) => spawnSync('node', [script, ...codes], { cwd: tree, encoding: 'utf8' });

test('source sites, JSDoc mentions and the word boundary', () => {
  const { status, stdout } = run('DI_BAG_SAMPLE', 'DI_BAG_RENAMED_SAMPLE');
  expect(status).toBe(0);
  expect(stdout).toContain('DI_BAG_SAMPLE -> DI_BAG_RENAMED_SAMPLE   anchor #di-bag-sample -> #di-bag-renamed-sample');
  expect(stdout).toContain('src single-quoted: 1  src/sample.ts:4[throw]');
  expect(stdout).toContain('src backticked (JSDoc): 1  src/sample.ts x1');
  expect(stdout).toContain('longer codes sharing the old prefix: ["DI_BAG_SAMPLES_ARE_LONGER"]');
  expect(stdout).toContain('new name already used in src/tests/docs: False');
});

test('only a string equal to the code is rewritable; a longer string, a title and a pattern are not', () => {
  const { stdout } = run('DI_BAG_SAMPLE', 'DI_BAG_RENAMED_SAMPLE');
  expect(stdout).toContain('tests: 5 occurrences');
  expect(stdout).toContain('   1  string equal to the code (codemod rewrites): tests/assertions.ts');
  expect(stdout).toContain('   3  other TypeScript occurrence (codemod reports, edit by hand): tests/assertions.ts');
  expect(stdout).toContain('   1  JavaScript without types (not reported, edit by hand): tests/plain.node.mjs');
});

test('a Markdown link is told apart from the same anchor as plain text', () => {
  const { stdout } = run('DI_BAG_SAMPLE', 'DI_BAG_RENAMED_SAMPLE');
  expect(stdout).toContain('   docs/agent/errors.md: code x2, anchor x2 of which real links x1');
  expect(stdout).toContain('   docs/guides/guide.md: code x1, anchor x1 of which real links x0');
});

test('a longer anchor is not counted as the old anchor', () => {
  const { stdout } = run('DI_BAG_SAMPLE', 'DI_BAG_RENAMED_SAMPLE');
  expect(stdout).toContain('   docs/guides/guide.md: code x1, anchor x1 of which real links x0');
});

test('the gate it prints is boundary-safe, so a new code that extends the old one passes it', () => {
  const { stdout } = run('DI_BAG_SAMPLE', 'DI_BAG_SAMPLE_KEY');
  expect(stdout).toContain('new code starts with the old code: True');
  expect(stdout).toContain("  grep -rnE 'DI_BAG_SAMPLE([^A-Z_]|$)' src tests examples scripts AGENTS.md");
  expect(stdout).toContain("  grep -rnE 'di-bag-sample([^a-z0-9-]|$)' src tests examples scripts AGENTS.md");
  expect(run('DI_BAG_SAMPLE', 'DI_BAG_RENAMED_SAMPLE').stdout).toContain('new code starts with the old code: False');
});

test('two codes are required', () => {
  const { status, stderr } = run('DI_BAG_SAMPLE');
  expect(status).toBe(2);
  expect(stderr).toContain('usage: node scripts/error-code-facts.mjs OLD_CODE NEW_CODE');
});

test('more than two codes are rejected', () => {
  const { status, stderr } = run('DI_BAG_SAMPLE', 'DI_BAG_RENAMED_SAMPLE', 'DI_BAG_EXTRA');
  expect(status).toBe(2);
  expect(stderr).toContain('usage: node scripts/error-code-facts.mjs OLD_CODE NEW_CODE');
});

test('a longer code sharing the new name prefix does not count as prior use', () => {
  const { stdout } = run('DI_BAG_SAMPLE', 'DI_BAG_SAMPLES');
  expect(stdout).toContain('new name already used in src/tests/docs: False');
});
