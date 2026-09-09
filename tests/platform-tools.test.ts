import { afterEach, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { captureToolPin } from '../scripts/pin-platform-tools.ts';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function probe(source: string): [string, string] {
  const root = mkdtempSync(join(tmpdir(), 'di-bag-tool-pin-'));
  roots.push(root);
  const script = join(root, 'probe.cjs');
  writeFileSync(script, source);
  return [realpathSync(process.execPath), script];
}

test('tool capture binds the actual artifact and exact observed version output', () => {
  const argv = probe("console.log('deno 2.9.6 (stable)'); console.log('v8 other-version');");
  const result = captureToolPin(argv, '2.9.6');
  expect(result).toEqual({
    status: 'pinned', argv, versionArgv: [...argv, '--version'], version: '2.9.6',
    versionText: 'deno 2.9.6 (stable)\nv8 other-version\n',
    sha256: createHash('sha256').update(Uint8Array.from(readFileSync(argv[1]))).digest('hex'),
  });
});

test('tool capture rejects wrong versions, substring matches and unsuccessful probes', () => {
  for (const source of [
    "console.log('Version 2.9.5')",
    "console.log('Version 12.9.6')",
    "console.log('Version 2.9.60')",
    "console.log('Version 2.9.6-beta.1')",
    "console.log('Version 2.9.6'); console.error('warning')",
    "console.log('Version 2.9.6'); process.exit(1)",
    "process.exit(0)",
  ]) expect(() => captureToolPin(probe(source), '2.9.6')).toThrow();
  expect(() => captureToolPin(['/does-not-exist/tool'], '2.9.6')).toThrow();
  expect(() => captureToolPin(['relative/tool'], '2.9.6')).toThrow();
});
