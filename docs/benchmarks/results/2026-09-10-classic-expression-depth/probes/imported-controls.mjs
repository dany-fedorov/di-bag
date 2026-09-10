import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import ts from '/tmp/di-bag-replacement-spike/node_modules/typescript/lib/typescript.js';
import {scaleSource, scalePath, describeDiagnostic} from '/tmp/di-bag-replacement-spike/tests/compiler.ts';

// Diagnostic controls only: no production or compiler implementation is modified.
const [kind, form, size] = process.argv.slice(2), count = Number(size);
if (!['imported-class', 'imported-any'].includes(kind)) throw new Error('unknown control');
const source = scaleSource(count, form, 'valid');
const declaration = kind === 'imported-any'
  ? 'export declare const DiBag: any;\n'
  : 'interface Chain { add(value: object): Chain; replace(key: string, value: unknown): Chain; end(): { resolve(key: string): number }; }\nexport declare class DiBag { static begin(): Chain; }\n';
const root = '/tmp/di-bag-replacement-spike';
const options = {strict:true,noEmit:true,skipLibCheck:true,noUncheckedIndexedAccess:true,exactOptionalPropertyTypes:true,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.NodeNext,moduleResolution:ts.ModuleResolutionKind.NodeNext,types:[]};
const host = ts.createCompilerHost(options), original = host.getSourceFile.bind(host);
host.getSourceFile = (name, language, ...rest) => name === scalePath
  ? ts.createSourceFile(name, source, language, true)
  : name === path.join(root, 'src/index.ts')
    ? ts.createSourceFile(name, declaration, language, true)
    : original(name, language, ...rest);
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
const label = `${kind}-${form}-${count}`;
fs.writeFileSync(new URL(label + '.source.ts', import.meta.url), source);
fs.writeFileSync(new URL(label + '.index.ts', import.meta.url), declaration);
Error.stackTraceLimit = 1500;
const start = performance.now();
let program;
const evidence = {kind, form, count, diagnosticControl:true, compiler:ts.version,node:process.version,generatedSha256:sha(source),declarationSha256:sha(declaration),options};
try {
  program = ts.createProgram([scalePath], options, host);
  evidence.diagnostics = ts.getPreEmitDiagnostics(program).map(describeDiagnostic);
  evidence.instantiations = program.getInstantiationCount();
  evidence.accepted = evidence.diagnostics.length === 0;
} catch (error) {
  evidence.accepted = false;
  evidence.error = String(error);
  evidence.stack = error.stack;
}
evidence.sourceFiles = program?.getSourceFiles().map(file => ({name:file.fileName,sha256:sha(file.text)}));
if (evidence.sourceFiles.some(file => file.name.startsWith(root + '/src/') && file.name !== root + '/src/index.ts')) throw new Error('control unexpectedly imports library source');
evidence.milliseconds = performance.now() - start;
evidence.maxRssMiB = process.resourceUsage().maxRSS / 1024;
console.log(JSON.stringify(evidence));
process.exitCode = evidence.accepted ? 0 : 1;
