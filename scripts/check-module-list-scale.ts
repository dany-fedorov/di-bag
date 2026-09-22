import { performance } from 'node:perf_hooks';
import ts from 'typescript';
import { compilerProgram, describeDiagnostic, moduleListScaleSource, tokenScalePath } from '../tests/compiler.ts';
import type { ModuleListCase, ModuleListShape } from '../tests/compiler.ts';

const shapes: ModuleListShape[] = ['separate-0.4', 'separate-0.5', 'one-list'];
const scenarios: ModuleListCase[] = ['valid', 'colliding-export'];
const shape = shapes.find(value => value === process.argv[2]);
const scenario = scenarios.find(value => value === process.argv[3]);
const count = Number(process.argv[4]);
if (!shape || !scenario || process.argv.length > 5 || ![1, 10, 50, 100].includes(count)) throw new Error('usage: check-module-list-scale.ts <separate-0.4|separate-0.5|one-list> <valid|colliding-export> <1|10|50|100>');

const source = moduleListScaleSource(count, shape, scenario);
const start = performance.now();
const program = compilerProgram(tokenScalePath, source);
const diagnostics = ts.getPreEmitDiagnostics(program).map(describeDiagnostic);
const boundary = source.split('\n').findIndex(line => line.includes('module-list-boundary')) + 1;
console.log(JSON.stringify({
  count, shape, scenario, typescript: ts.version, node: process.version,
  milliseconds: Math.round(performance.now() - start),
  maxRssMiB: Math.round(process.resourceUsage().maxRSS / 1024),
  boundaryLine: boundary === 0 ? undefined : boundary,
  diagnostics: diagnostics.map(item => ({ code: item.code, line: item.line, message: item.message })),
  instantiations: program.getInstantiationCount(),
}));
