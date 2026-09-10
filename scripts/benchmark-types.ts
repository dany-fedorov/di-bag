import { spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import ts from 'typescript';
import type { MatrixCase } from './benchmark-result.ts';
import { nativeScale } from './native-scale.ts';
import { nativeLimits, resolveNative } from './native-compiler.ts';
import { runCompilerCase } from './compiler-case.ts';
import {
  compilerProgram,
  describeDiagnostic,
  scaleBoundaryLine,
  scalePath,
  scaleSource,
} from '../tests/compiler.ts';
import type {
  ScaleCase,
  ScaleForm,
} from '../tests/compiler.ts';

const forms: ScaleForm[] = ['bulk', 'chained', 'grouped', 'replacement'];
const scenarios: ScaleCase[] = ['valid', 'missing', 'wrong-shape'];

if (process.argv[2] === '--worker') {
  const count = Number(process.argv[3]);
  const form = forms.find(value => value === process.argv[4]);
  const scenario = scenarios.find(value => value === process.argv[5]);
  if (process.argv.length !== 6 || !form || !scenario || ![100, 500, 1000].includes(count)) throw new Error('invalid benchmark case');
  const source = scaleSource(count, form, scenario);
  const boundaryLine = scaleBoundaryLine(source, count, form, scenario);
  const start = performance.now();
  const program = compilerProgram(scalePath, source);
  const errors = ts.getPreEmitDiagnostics(program).map(describeDiagnostic);
  const instantiations = program.getInstantiationCount();
  const codes = [...new Set(errors.map(error => error.code))];
  const intended = scenario === 'missing' ? 'required service registrations are missing' : 'provided service does not satisfy its consumer dependency';
  const accepted = scenario === 'valid'
    ? errors.length === 0
    : !codes.includes(2589) && errors.filter(error =>
      error.file === scalePath && error.line === boundaryLine && error.message.includes(intended)
    ).length === 1;
  console.log(JSON.stringify({
    count, form, scenario, accepted, typescript: ts.version, node: process.version,
    milliseconds: Math.round(performance.now() - start),
    maxRssMiB: Math.round(process.resourceUsage().maxRSS / 1024),
    boundaryLine, diagnostics: errors,
    diagnosticCount: errors.length, codes, firstDiagnostic: errors[0], instantiations,
  }));
} else {
  main().catch(error => { console.error(error); process.exitCode = 1; });
}

async function main() {
  const flags = process.argv.slice(2);
  if (new Set(flags).size !== flags.length || flags.some(flag => flag !== '--native' && flag !== '--tokens')) throw new Error('invalid benchmark arguments');
  const tokenMode = flags.includes('--tokens'), nativeMode = flags.includes('--native');
  const selectedForms = tokenMode ? ['bindings', 'modules'] as const : forms;
  const selectedScenarios = tokenMode ? ['valid', 'missing-final-token', 'mismatched-invariant-service'] as const : scenarios;
  const failures: Array<MatrixCase & { reason: unknown }> = [];
  const totalCases = 3 * selectedForms.length * selectedScenarios.length;
  const root = process.cwd();
  const native = nativeMode ? await resolveNative(root) : undefined;
  console.log(JSON.stringify({
    typescript: native?.version ?? ts.version, compiler: native, runner: process.version,
    matrix: tokenMode ? 'tokens' : 'named', cases: totalCases, timeoutMilliseconds: 60000,
    ...(nativeMode ? { limits: nativeLimits, note: 'Native metrics and sampled Linux child RSS; one supervised executable per case.' }
      : { bun: spawnSync('bun', ['--version'], { encoding: 'utf8' }).stdout?.trim(),
        note: tokenMode ? 'Each case runs in a fresh Node process; modules means distinct reusable token modules.'
          : 'Each case runs in a fresh Node process; grouped means reusable registration maps of 50 providers.' }),
  }));
  for (const count of [100, 500, 1000]) for (const form of selectedForms) for (const scenario of selectedScenarios) {
    const item = { count, form, scenario } as MatrixCase;
    let row: Record<string, unknown>;
    if (native) {
      row = await nativeScale(root, native, item);
    } else row = await runCompilerCase(root, 'classic', item);
    if (!row.accepted) failures.push({ ...item, reason: row.failureReason });
    console.log(JSON.stringify(row));
  }
  console.log(JSON.stringify({ cases: totalCases, accepted: totalCases - failures.length, failures }));
}
