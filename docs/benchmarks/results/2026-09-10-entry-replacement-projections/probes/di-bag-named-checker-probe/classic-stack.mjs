import {readFileSync} from 'node:fs';
import ts from '/tmp/di-bag-replacement-spike/node_modules/@typescript/old/lib/typescript.js';
import {scaleSource,scalePath,compilerProgram} from '/tmp/di-bag-replacement-spike/tests/compiler.ts';
Error.stackTraceLimit=250;
const source=scaleSource(1000,'chained','valid');
try { const program=compilerProgram(scalePath,source); const diagnostics=ts.getPreEmitDiagnostics(program); console.log(JSON.stringify({diagnostics:diagnostics.map(d=>({code:d.code,message:ts.flattenDiagnosticMessageText(d.messageText,'\n')})),instantiations:program.getInstantiationCount()})); }
catch(error) { console.error(error.stack); process.exitCode=1; }
