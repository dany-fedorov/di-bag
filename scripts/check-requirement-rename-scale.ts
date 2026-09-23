import { performance } from 'node:perf_hooks';
import { resolve } from 'node:path';
import ts from 'typescript';
import { compilerProgram, describeDiagnostic, requirementRenameScaleSource } from '../tests/compiler.ts';

const count = Number(process.argv[2]);
if (process.argv.length !== 3 || count !== 20) throw new Error('usage: check-requirement-rename-scale.ts 20');
const source = requirementRenameScaleSource(count);
const path = resolve('tests/generated-requirement-rename-scale.ts');
const start = performance.now();
const program = compilerProgram(path, source);
program.getTypeChecker();
const diagnostics = ts.getPreEmitDiagnostics(program).map(describeDiagnostic);
const instantiations = program.getInstantiationCount();
const milliseconds = Math.round(performance.now() - start);
const maxRssMiB = Math.round(process.resourceUsage().maxRSS / 1024);
console.log(JSON.stringify({
  case: 'requirements-20', count, accepted: diagnostics.length === 0,
  diagnosticCount: diagnostics.length, diagnostics, instantiations,
  milliseconds, maxRssMiB, typescript: ts.version, node: process.version,
}));
