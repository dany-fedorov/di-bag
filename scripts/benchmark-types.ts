import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import ts from 'typescript';
import {
  compilerProgram,
  describeDiagnostic,
  scaleBoundaryLine,
  scalePath,
  scaleSource,
  tokenScalePath,
} from '../tests/compiler.ts';
import type {
  ScaleCase,
  ScaleForm,
  TokenScaleCase,
  TokenScaleForm,
} from '../tests/compiler.ts';

const forms: ScaleForm[] = ['bulk', 'chained', 'grouped', 'replacement'];
const scenarios: ScaleCase[] = ['valid', 'missing', 'wrong-shape'];

if (process.argv[2] === '--worker') {
  const count = Number(process.argv[3]);
  const form = forms.find(value => value === process.argv[4]);
  const scenario = scenarios.find(value => value === process.argv[5]);
  if (!form || !scenario || ![100, 500, 1000].includes(count)) throw new Error('invalid benchmark case');
  const source = scaleSource(count, form, scenario);
  const boundaryLine = scaleBoundaryLine(source, count, form, scenario);
  const start = performance.now();
  const program = compilerProgram(scalePath, source);
  const errors = ts.getPreEmitDiagnostics(program).map(describeDiagnostic);
  const instantiations = program.getInstantiationCount();
  const codes = [...new Set(errors.map(error => error.code))];
  const intended = scenario === 'missing' ? 'missing factories' : 'a dependency has the wrong shape';
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
  type MatrixCase = {
    count: number;
    form: ScaleForm | TokenScaleForm;
    scenario: ScaleCase | TokenScaleCase;
  };
  type DescribedDiagnostic = ReturnType<typeof describeDiagnostic>;

  const timeoutMilliseconds = 60_000;
  const tokenMode = process.argv[2] === '--tokens';
  if (process.argv.length !== (tokenMode ? 3 : 2)) throw new Error('invalid benchmark arguments');
  const tokenForms: TokenScaleForm[] = ['bindings', 'modules'];
  const tokenScenarios: TokenScaleCase[] = ['valid', 'missing-final-token', 'mismatched-invariant-service'];
  const selectedForms = tokenMode ? tokenForms : forms;
  const selectedScenarios = tokenMode ? tokenScenarios : scenarios;
  const failures: Array<MatrixCase & { reason: string }> = [];
  const totalCases = 3 * selectedForms.length * selectedScenarios.length;
  const tokenWorker = resolve(import.meta.dirname, 'check-token-scale.ts');

  console.log(JSON.stringify({
    typescript: ts.version,
    runner: process.version,
    bun: spawnSync('bun', ['--version'], { encoding: 'utf8' }).stdout?.trim(),
    matrix: tokenMode ? 'tokens' : 'named',
    cases: totalCases,
    timeoutMilliseconds,
    note: tokenMode
      ? 'Each case runs in a fresh Node process; modules means distinct reusable token modules.'
      : 'Each case runs in a fresh Node process; grouped means reusable registration maps of 50 providers.',
  }));

  for (const count of [100, 500, 1000]) {
    for (const form of selectedForms) {
      for (const scenario of selectedScenarios) {
        const item = { count, form, scenario } as MatrixCase;
        const workerArgs = tokenMode
          ? [tokenWorker, form, scenario, String(count)]
          : [import.meta.filename, '--worker', String(count), form, scenario];
        const start = performance.now();
        const child = spawnSync('node', [
          '--max-old-space-size=3072', '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', ...workerArgs,
        ], { encoding: 'utf8', timeout: timeoutMilliseconds, maxBuffer: 4 * 1024 * 1024 });
        const processMilliseconds = Math.round(performance.now() - start);
        const completed = child.status === 0 && child.signal === null && child.error === undefined
          && child.stderr === '' && child.stdout.trim().length > 0;

        let result: Record<string, unknown> | undefined;
        let parseError: string | undefined;
        if (completed) {
          try {
            const parsed: unknown = JSON.parse(child.stdout);
            if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
              result = parsed as Record<string, unknown>;
            } else {
              parseError = 'worker JSON is not an object';
            }
          } catch (error) {
            parseError = error instanceof Error ? error.message : String(error);
          }
        }

        const identityMatches = result !== undefined
          && result.count === count && result.form === form && result.scenario === scenario;
        const diagnostics = result?.diagnostics;
        const hasDiagnostics = Array.isArray(diagnostics) && diagnostics.every(error =>
          typeof error === 'object' && error !== null
            && typeof (error as { code?: unknown }).code === 'number'
            && typeof (error as { message?: unknown }).message === 'string'
        );
        const described = hasDiagnostics ? diagnostics as DescribedDiagnostic[] : [];
        const boundaryLine = result?.boundaryLine;
        const intended = scenario === 'missing' || scenario === 'missing-final-token'
          ? 'missing factories'
          : tokenMode && form === 'bindings'
            ? 'token dependency has an incompatible or opaque contract'
            : 'a dependency has the wrong shape';
        const expectedPath = tokenMode ? tokenScalePath : scalePath;
        const validCase = scenario === 'valid';
        const gateAccepted = completed && parseError === undefined && identityMatches && hasDiagnostics
          && described.every(error => error.file === expectedPath)
          && (validCase
            ? described.length === 0
            : !described.some(error => error.code === 2589)
              && typeof boundaryLine === 'number'
              && described.filter(error =>
                error.line === boundaryLine && error.message.includes(intended)
              ).length === 1);

        if (result !== undefined) {
          const reason = gateAccepted ? undefined
            : !identityMatches ? 'worker case identity mismatch'
              : !hasDiagnostics ? 'worker diagnostics are missing or malformed'
                : validCase ? `valid case returned ${described.length} diagnostics`
                  : described.some(error => error.code === 2589) ? 'compiler returned TS2589'
                    : described.some(error => error.file !== expectedPath) ? 'diagnostic came from another file'
                      : 'intended diagnostic did not occur exactly once at the generated boundary';
          if (reason !== undefined) failures.push({ ...item, reason });
          console.log(JSON.stringify({
            ...result,
            accepted: gateAccepted,
            processMilliseconds,
            ...(reason === undefined ? {} : { failureReason: reason }),
          }));
          continue;
        }

        const reason = !completed ? 'worker did not complete cleanly'
          : `worker returned malformed JSON: ${parseError ?? 'unknown parse failure'}`;
        failures.push({ ...item, reason });
        console.log(JSON.stringify({
          ...item,
          accepted: false,
          processMilliseconds,
          status: child.status,
          signal: child.signal,
          error: child.error?.message,
          stderr: child.stderr,
          stdout: child.stdout,
          parseError,
          failureReason: reason,
        }));
      }
    }
  }
  // These are report commands: failed forms are data, while focused tests enforce the gates.
  console.log(JSON.stringify({ cases: totalCases, accepted: totalCases - failures.length, failures }));
}
