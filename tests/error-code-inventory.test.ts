import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const script = resolve(__dirname, '../scripts/error-code-inventory.mjs');
function run(directory: string) {
  const result = spawnSync('node', [script, resolve(__dirname, 'fixtures/error-code-inventory', directory), '--json'], { encoding: 'utf8' });
  return { status: result.status, summary: result.stderr.trim(), rows: JSON.parse(result.stdout) as Array<{ line: number; owner: string; codes: string[]; message: string; missingDetails?: string[] }> };
}

test('every literal is accounted for, and declarations and JSDoc are not rows', () => {
  const { status, summary, rows } = run('ok');
  expect(status).toBe(0);
  expect(summary).toBe('literals: 7; accounted: 7; rows: 4; codes: 4; unclassified: 0; incomplete details: 0');
  expect(rows.flatMap(row => row.codes)).not.toContain('DI_BAG_IN_JSDOC');
  expect(rows.flatMap(row => row.codes)).not.toContain('DI_BAG_DECLARED');
});

test('a ternary is one row with two codes and its own message', () => {
  const row = run('ok').rows.find(item => item.codes.length === 2)!;
  expect(row.codes).toEqual(['DI_BAG_CLOSING', 'DI_BAG_CLOSED']);
  expect(row.message).toBe('bag is ${state}');
});

test('a helper call does not borrow the message of a throw two lines below', () => {
  const [helper, thrower] = run('ok').rows.filter(item => item.codes[0] === 'DI_BAG_SAMPLE_OPTIONS');
  expect(helper!.owner).toBe('snapshotOptions');
  expect(helper!.message).toBe('');
  expect(thrower!.message).toBe('close options must be an object');
});

test('a call split over lines finds its message on the next line', () => {
  const row = run('ok').rows.find(item => item.codes[0] === 'DI_BAG_INVALID_DEPENDENCY_ACCESS')!;
  expect(row.owner).toBe('libraryError');
  expect(row.message).toBe('Cannot inspect the dependencies of ${label}');
});

test('a literal with no recognisable owner fails the run', () => {
  const { status, summary } = run('bad');
  expect(status).toBe(1);
  expect(summary).toContain('unclassified: 1');
});

test('a literal after a recognised call is not assigned to that call', () => {
  const { status, summary, rows } = run('adjacent');
  expect(status).toBe(1);
  expect(summary).toContain('unclassified: 1');
  expect(rows.map(row => [row.owner, row.codes])).toEqual([
    ['libraryError', ['DI_BAG_SAMPLE_OPTIONS']],
    ['UNCLASSIFIED', ['DI_BAG_FAKE']],
  ]);
});

test('DI_BAG_INVALID_ARGUMENT must carry operation, argument and expected; a word in the message does not count', () => {
  const { status, summary, rows } = run('incomplete');
  expect(status).toBe(1);
  expect(summary).toContain('unclassified: 0; incomplete details: 3');
  expect(rows.map(row => row.missingDetails)).toEqual([[], ['expected'], ['argument', 'expected'], ['argument', 'expected']]);
});

test('nested templates and diagnostic calls retain their own messages and codes', () => {
  const { status, rows } = run('nested');
  expect(status).toBe(0);
  expect(rows.map(row => [row.owner, row.codes, row.message])).toEqual([
    ['libraryError', ['DI_BAG_SAMPLE_OPTIONS'], 'count ${count === 1 ? `${count} item` : `${count} items`}'],
    ['diagnosticMessage', ['DI_BAG_CLOSED'], "wait ${reason === 'timeout' ? `timed out after ${timeout}ms` : 'was aborted'}"],
    ['diagnostic', ['DI_BAG_CLOSED'], ''],
  ]);
});
