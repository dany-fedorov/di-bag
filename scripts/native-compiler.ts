import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { supervise, type ProcessLimits } from './native-process.ts';
import type { Diagnostic } from './benchmark-result.ts';
export { matchDiagnosticMarkers } from '../tests/diagnostic-markers.ts';

export const nativeLimits: ProcessLimits = { timeoutMilliseconds: 60_000, maxRssMiB: 3072, maxOutputBytes: 4 * 1024 * 1024, sampleMilliseconds: 20 };
export type NativeCompiler = { executable: string; version: string; wrapperVersion: string; platformPackage: string };
const metricUnits: Record<string, string> = {
  Files: '', Lines: '', Identifiers: '', Symbols: '', Types: '', Instantiations: '',
  'Memory used': 'K', 'Memory allocs': '', 'Config time': 's', 'Parse time': 's', 'Bind time': 's',
  'Check time': 's', 'Emit time': 's', 'Total time': 's',
};
export function parseNativeDiagnostics(stdout: string, cwd: string) {
  const diagnostics: Diagnostic[] = [], unparsed: string[] = [];
  const metrics: Record<string, number> = {};
  let current: Diagnostic | undefined;
  for (const line of stdout.split(/\r?\n/)) {
    if (!line.trim()) { current = undefined; continue; }
    const located = /^(.*)\((\d+),(\d+)\): error TS(\d+): (.*)$/.exec(line);
    const global = /^error TS(\d+): (.*)$/.exec(line);
    if (located) {
      current = { file: resolve(cwd, located[1]!), line: Number(located[2]), column: Number(located[3]), code: Number(located[4]), message: located[5]! };
      diagnostics.push(current); continue;
    }
    if (global) { current = { code: Number(global[1]), message: global[2]! }; diagnostics.push(current); continue; }
    if (current && /^\s+\S/.test(line)) { current.message += `\n${line}`; continue; }
    current = undefined;
    const metric = /^([^:]+):\s*(\d+(?:\.\d+)?)(K|s)?$/.exec(line);
    if (metric && Object.hasOwn(metricUnits, metric[1]!) && (metric[3] ?? '') === metricUnits[metric[1]!]) {
      metrics[metric[1]!] = Number(metric[2]);
    } else unparsed.push(line);
  }
  return { diagnostics, metrics, unparsed };
}

export async function resolveNative(root: string): Promise<NativeCompiler> {
  const require = createRequire(resolve(root, 'package.json'));
  const packagePath = require.resolve('@typescript/native/package.json');
  const wrapperVersion = JSON.parse(readFileSync(packagePath, 'utf8')).version as string;
  const platformPath = createRequire(packagePath).resolve(`@typescript/typescript-${process.platform}-${process.arch}/package.json`);
  const version = JSON.parse(readFileSync(platformPath, 'utf8')).version as string;
  if (wrapperVersion !== '7.0.2' || version !== '7.0.2') throw new Error('Native package version mismatch');
  const executable = resolve(dirname(platformPath), 'lib/tsc');
  const probe = await supervise(executable, ['--version'], root, { ...nativeLimits, timeoutMilliseconds: 10000 });
  if (probe.status !== 0 || probe.signal !== null || probe.terminationReason || probe.error || probe.stderr || probe.stdout.trim() !== 'Version 7.0.2') {
    throw new Error(`Native binary identity failed: ${JSON.stringify(probe)}`);
  }
  return { executable, version, wrapperVersion, platformPackage: platformPath };
}

export async function compileNative(compiler: NativeCompiler, cwd: string, files: readonly string[], options: Record<string, unknown> = {}, limits = nativeLimits) {
  if (!files.length) throw new Error('Native projects require nonempty explicit files');
  const config = resolve(cwd, 'tsconfig.native.json');
  writeFileSync(config, JSON.stringify({ compilerOptions: {
    strict: true, noUncheckedIndexedAccess: true, exactOptionalPropertyTypes: true, target: 'ES2022',
    module: 'NodeNext', moduleResolution: 'NodeNext', types: [], noEmit: true, ...options,
  }, files }, null, 2));
  const child = await supervise(compiler.executable, ['-p', config, '--pretty', 'false', '--extendedDiagnostics'], cwd, limits);
  const parsed = parseNativeDiagnostics(child.stdout, cwd);
  const checked = child.signal === null && child.terminationReason === undefined && child.error === undefined
    && child.stderr === '' && parsed.unparsed.length === 0 && (parsed.metrics.Files ?? 0) > 0
    && (parsed.diagnostics.length === 0 ? child.status === 0 : child.status === 1)
    && parsed.diagnostics.every(diagnostic => diagnostic.file !== undefined && diagnostic.file !== config);
  return { ...child, ...parsed, checked };
}
