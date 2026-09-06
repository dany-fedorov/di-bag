import { performance } from 'node:perf_hooks';
import ts from 'typescript';
import {
  describeDiagnostic,
  diagnostics,
  tokenScaleBoundaryLine,
  tokenScalePath,
  tokenScaleSource,
} from '../tests/compiler.ts';
import type { TokenScaleCase, TokenScaleForm } from '../tests/compiler.ts';

const forms: TokenScaleForm[] = ['bindings', 'modules'];
const scenarios: TokenScaleCase[] = ['valid', 'missing-final-token', 'mismatched-invariant-service'];
const form = forms.find(value => value === process.argv[2]);
const scenario = scenarios.find(value => value === process.argv[3]);
if (!form || !scenario || process.argv.length !== 4) throw new Error('invalid token scale case');

const source = tokenScaleSource(100, form, scenario);
const start = performance.now();
const errors = diagnostics(tokenScalePath, source).map(describeDiagnostic);
console.log(JSON.stringify({
  count: 100,
  form,
  scenario,
  typescript: ts.version,
  node: process.version,
  milliseconds: Math.round(performance.now() - start),
  maxRssMiB: Math.round(process.resourceUsage().maxRSS / 1024),
  boundaryLine: tokenScaleBoundaryLine(source),
  diagnostics: errors,
}));
