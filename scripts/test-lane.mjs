// scripts/test-lane.mjs
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';

// Files that build compiler programs, pack the package, spawn native or platform tools, or benchmark.
const compilerLane = new Set([
  'benchmark-compiler-controls', 'benchmark-types', 'comparator-contract', 'compiler-case', 'incremental-scale',
  'native-compiler', 'native-diagnostic-markers', 'native-package', 'native-process', 'native-replacement-diagnostics',
  'package', 'performance-baseline', 'performance-evidence', 'platform-deno', 'platform-evidence', 'platform-tools',
  'platform/browser-worker', 'release-artifacts', 'runtime-benchmark-child', 'token-package', 'token-scale',
  'type-scale', 'types',
]);

const [lane, ...rest] = process.argv.slice(2);
if (lane !== 'fast' && lane !== 'compiler') {
  console.error('usage: node scripts/test-lane.mjs fast|compiler [--list] [bun test arguments]');
  process.exit(2);
}
const files = readdirSync('tests', { recursive: true })
  .map(String)
  .filter(name => name.endsWith('.test.ts'))
  .filter(name => compilerLane.has(name.replace(/\.test\.ts$/, '')) === (lane === 'compiler'))
  .map(name => `tests/${name}`)
  .sort();
if (rest[0] === '--list') {
  console.log(files.join('\n'));
  process.exit(0);
}
const result = spawnSync('bun', ['test', ...files, ...rest], { stdio: 'inherit' });
process.exit(result.status ?? 1);
