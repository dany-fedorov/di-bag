import ts from '/tmp/di-bag-replacement-spike/node_modules/typescript/lib/typescript.js';
import {compilerProgram,describeDiagnostic} from '/tmp/di-bag-replacement-spike/tests/compiler.ts';
import path from 'node:path';
const source=`import type {From,Entry} from '../src/types';
import type {Assert,Equal} from './types/assert';
type X<K extends string|symbol>={key:K;registration:()=>number};
type C=[Assert<Equal<keyof From<X<string>>,string>>,Assert<Equal<keyof From<X<symbol>>,symbol>>,Assert<Equal<keyof From<X<never>>,never>>,Assert<Equal<keyof From<never>,never>>,Assert<Equal<keyof From<X<'a'|'b'>>, 'a'|'b'>>,Assert<Equal<keyof From<Entry>,string|symbol>>,Assert<Equal<keyof From<X<string & {}>>,string & {}>>,Assert<Equal<keyof From<X<\`x:\${string}\`>>,\`x:\${string}\`>>];`;
const p=compilerProgram(path.resolve('tests/generated-key-equivalence.ts'),source); console.log(JSON.stringify(ts.getPreEmitDiagnostics(p).map(describeDiagnostic)));
