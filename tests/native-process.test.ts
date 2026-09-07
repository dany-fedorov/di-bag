import { expect, test } from 'bun:test';
import { execFileSync } from 'node:child_process';
import { supervise, validateLimits } from '../scripts/native-process.ts';

const limits = { timeoutMilliseconds: 3000, maxRssMiB: 256, maxOutputBytes: 4096, sampleMilliseconds: 20 };
const node = execFileSync('node', ['-p', 'process.execPath'], { encoding: 'utf8', timeout: 10000 }).trim();
const child = (source: string, changes = {}) => supervise(node, ['-e', source], process.cwd(), { ...limits, ...changes });

test('supervisor retains clean child streams and exit status', async () => {
  expect((await child("console.log(process.versions.bun ? 'bun' : 'node')")).stdout).toBe('node\n');
  expect(await child("console.log('out'); console.error('err')")).toMatchObject({ status: 0, signal: null, stdout: 'out\n', stderr: 'err\n' });
  expect(await child('process.exit(3)')).toMatchObject({ status: 3, signal: null });
});
test('failed spawn is explicit evidence', async () => {
  expect(await supervise('/nonexistent-di-bag-compiler', [], process.cwd(), limits)).toMatchObject({ terminationReason: 'spawn', status: null });
});
for (const [reason, changes, source] of [
  ['timeout', { timeoutMilliseconds: 20 }, 'setInterval(() => {}, 1000)'],
  ['memory', { maxRssMiB: 8 }, 'console.log(process.pid); setInterval(() => {}, 1000)'],
  ['output', { maxOutputBytes: 1024 }, "console.log(process.pid); process.stdout.write('x'.repeat(100000)); setInterval(() => {}, 1000)"],
] as const) {
  test(`supervisor terminates and reaps ${reason} child`, async () => {
    const result = await child(source, changes);
    expect(result.terminationReason).toBe(reason);
    expect(result.signal).toBe('SIGKILL');
    expect(Buffer.byteLength(result.stdout) + Buffer.byteLength(result.stderr)).toBeLessThanOrEqual(changes.maxOutputBytes ?? 4096);
    const pid = Number(result.stdout.split('\n')[0]);
    if (Number.isInteger(pid) && pid > 0) expect(() => process.kill(pid, 0)).toThrow();
    expect(result.milliseconds).toBeLessThan(3000);
  });
}
test('invalid limits and unsupported platforms fail before spawning', () => {
  for (const key of Object.keys(limits)) for (const value of [0, -1, Infinity, NaN]) {
    expect(() => validateLimits({ ...limits, [key]: value }, 'linux')).toThrow();
  }
  expect(() => validateLimits(limits, 'darwin')).toThrow('Linux');
});
test('output overflow remains byte bounded when UTF8 is cut within a character', async () => {
  const result = await child("process.stdout.write('🙂'.repeat(1000)); setInterval(() => {}, 1000)", { maxOutputBytes: 1025 });
  expect(result.terminationReason).toBe('output');
  expect(Buffer.byteLength(result.stdout) + Buffer.byteLength(result.stderr)).toBeLessThanOrEqual(1025);
});
