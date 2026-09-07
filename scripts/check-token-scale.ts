import { performance } from 'node:perf_hooks';
import ts from 'typescript';
import {
  describeDiagnostic,
  compilerProgram,
  tokenScaleBoundaryLine,
  tokenScalePath,
  tokenScaleSource,
} from '../tests/compiler.ts';
import type { TokenScaleCase, TokenScaleForm } from '../tests/compiler.ts';

const forms: TokenScaleForm[] = ['bindings', 'modules'];
const scenarios: TokenScaleCase[] = ['valid', 'missing-final-token', 'mismatched-invariant-service'];
const form = forms.find(value => value === process.argv[2]);
const scenario = scenarios.find(value => value === process.argv[3]);
const count = process.argv[4] === undefined ? 100 : Number(process.argv[4]);
if (!form || !scenario || process.argv.length > 5 || ![100, 500, 1000].includes(count)) {
  throw new Error('invalid token scale case');
}

const source = tokenScaleSource(count, form, scenario);
const start = performance.now();
const program = compilerProgram(tokenScalePath, source);
const errors = ts.getPreEmitDiagnostics(program).map(describeDiagnostic);
const instantiations = program.getInstantiationCount();
console.log(JSON.stringify({
  count,
  form,
  scenario,
  typescript: ts.version,
  node: process.version,
  milliseconds: Math.round(performance.now() - start),
  maxRssMiB: Math.round(process.resourceUsage().maxRSS / 1024),
  boundaryLine: tokenScaleBoundaryLine(source),
  diagnostics: errors,
  instantiations,
}));
