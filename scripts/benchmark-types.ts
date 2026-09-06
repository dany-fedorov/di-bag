import { spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import ts from 'typescript';
import { describeDiagnostic, diagnostics, scalePath, scaleSource } from '../tests/compiler.ts';
import type { ScaleCase, ScaleForm } from '../tests/compiler.ts';

const forms: ScaleForm[] = ['bulk', 'chained', 'grouped', 'replacement'];
const scenarios: ScaleCase[] = ['valid', 'missing', 'wrong-shape'];

if (process.argv[2] === '--worker') {
  const count = Number(process.argv[3]);
  const form = forms.find(value => value === process.argv[4]);
  const scenario = scenarios.find(value => value === process.argv[5]);
  if (!form || !scenario || ![100, 500, 1000].includes(count)) throw new Error('invalid benchmark case');
  const start = performance.now();
  const errors = diagnostics(scalePath, scaleSource(count, form, scenario)).map(describeDiagnostic);
  const codes = [...new Set(errors.map(error => error.code))];
  const intended = scenario === 'missing' ? 'missing factories' : 'a dependency has the wrong shape';
  const accepted = scenario === 'valid'
    ? errors.length === 0
    : errors.length > 0 && !codes.includes(2589) && errors.some(error => error.message.includes(intended));
  console.log(JSON.stringify({
    count, form, scenario, accepted, typescript: ts.version, node: process.version,
    milliseconds: Math.round(performance.now() - start),
    maxRssMiB: Math.round(process.resourceUsage().maxRSS / 1024),
    diagnosticCount: errors.length, codes, firstDiagnostic: errors[0],
  }));
} else {
  const timeoutMilliseconds = 60_000;
  const failures: { count: number; form: ScaleForm; scenario: ScaleCase }[] = [];
  console.log(JSON.stringify({
    typescript: ts.version,
    runner: process.version,
    bun: spawnSync('bun', ['--version'], { encoding: 'utf8' }).stdout?.trim(),
    timeoutMilliseconds,
    note: 'Each case runs in a fresh Node process; grouped means reusable registration maps of 50 providers.',
  }));
  for (const count of [100, 500, 1000]) {
    for (const form of forms) {
      for (const scenario of scenarios) {
        const start = performance.now();
        const child = spawnSync('node', [
          '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',
          import.meta.filename, '--worker', String(count), form, scenario,
        ], { encoding: 'utf8', timeout: timeoutMilliseconds, maxBuffer: 1024 * 1024 });
        if (child.status === 0 && child.stdout?.trim()) {
          const result = JSON.parse(child.stdout);
          if (!result.accepted) failures.push({ count, form, scenario });
          console.log(JSON.stringify({ ...result, processMilliseconds: Math.round(performance.now() - start) }));
        } else {
          failures.push({ count, form, scenario });
          console.log(JSON.stringify({
            count, form, scenario, accepted: false,
            processMilliseconds: Math.round(performance.now() - start),
            status: child.status, signal: child.signal,
            error: child.error?.message, stderr: child.stderr?.trim(),
          }));
        }
      }
    }
  }
  // A report command: failed forms are data, while unit tests enforce the gates.
  console.log(JSON.stringify({ cases: 36, accepted: 36 - failures.length, failures }));
}
