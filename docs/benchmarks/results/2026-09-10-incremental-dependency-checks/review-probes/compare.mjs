import fs from 'node:fs';
import path from 'node:path';
import ts from '/tmp/di-bag-replacement-spike/node_modules/typescript/lib/typescript.js';
const existing = JSON.parse(fs.readFileSync('/tmp/di-bag-empty-dependency-probe/baseline.boundaries.json', 'utf8'));
const candidateVariant=process.argv[2]??'cached-finite';
const probe = path.resolve('tests/dependency-shortcuts-review.ts');
const histories = [...existing.histories];
const incoming = [...existing.incoming,
  '{[a]: BindWrongA} | {[b]: BindB}', '{[a]: BindWrongA} | {x: () => number}',
  '{[a]?: BindWrongA}', 'Record<symbol, BindWrongA>', 'Record<typeof a | typeof b, BindWrongA>',
  '{[a]: any}', '{[a]: never}', '{x: AnyNamed}', '{x: NeverNamed}',
  '{x: OptionalA}', '{[a]: BindA; x: Named}', '{[a]: BindA; x: (deps:{y:string})=>number}',
  '{[a]: BindA; consumer: () => number}', '{[a]: BindA; x: OpaqueTokens}',
];
for (const key of ['never', 'any', 'string', 'symbol', 'typeof a', 'typeof a | typeof b', '"consumer"', '"consumer" | typeof a', 'string & {readonly __brand: unique symbol}', '`svc:${string}`']) {
  for (const registration of ['any', 'never', 'NeedA | NeedWrongA', 'OptionalA', 'OptionalA | OpaqueTokens', 'AnyTokenNeed', 'NeverGraph', 'NeedA & OpaqueTokens', 'NeedA | NeedB', 'OpaqueTokens']) {
    histories.push(`{key:${key}; registration:${registration}}`);
  }
}
histories.push('{key:"consumer"; registration:NeedA} | {key:"opaque"; registration:OpaqueTokens} | {key:never; registration:NeedB}');
histories.push('{key:typeof a; registration:BindA} | {key:string; registration:OpaqueTokens}');
let source = existing.source.slice(0, existing.source.indexOf('declare const p_'))
  .replace(/import type \{Entry, IncrementalChecked, __OldToken, __NewToken, __NewWrong\} from '\.\.\/src\/types';/, `import type {Entry} from '../src/types';\nimport type * as Baseline from '../src/types.baseline-review';\nimport type * as Candidate from '../src/types.candidate-review';`);
source += `\ntype OptionalA = Provider<() => number, {}, readonly [], TokenGraph<readonly [], never, readonly [A]>>;
type AnyTokenNeed = Provider<() => number, {}, readonly [], TokenGraph<readonly [any]>>;
type NeverGraph = Provider<() => number, {}, readonly [], never>;
type NeedB = Provider<() => number, {}, readonly [], TokenGraph<readonly [B]>>;
`;
histories.forEach((e,i) => incoming.forEach((n,j) => {
  source += `declare const p_${i}_${j}: [Baseline.__Review<${e}, ${n}>, Candidate.__Review<${e}, ${n}>];\n`;
}));
const appended = `
type __Details<T> = T extends {tokens: infer X} ? X : never;
type __Message<T> = T extends Unsatisfied<infer M, unknown> ? M : never;
export type __Review<E extends Entry,N extends Registrations> = [OldTokenWrong<E,N>, NewTokenWrong<E,N>, NewWrong<E,N>, unknown extends IncrementalChecked<E,N> ? true : false, __Details<IncrementalChecked<E,N>>, __Message<IncrementalChecked<E,N>>];
`;
const virtual = new Map([[probe, source]]);
for (const [alias, variant] of [['baseline', 'baseline'], ['candidate', candidateVariant]]) {
  const localSnapshot=`/tmp/di-bag-dependency-shortcuts-review/${variant}.ts`;
  const snapshot=fs.existsSync(localSnapshot)?localSnapshot:`/tmp/di-bag-empty-dependency-probe/${variant}.ts`;
  virtual.set(path.resolve(`src/types.${alias}-review.ts`), fs.readFileSync(snapshot, 'utf8') + appended);
}
const options = {strict:true, noEmit:true, skipLibCheck:true, noUncheckedIndexedAccess:true, exactOptionalPropertyTypes:true, target:ts.ScriptTarget.ES2022, module:ts.ModuleKind.NodeNext, moduleResolution:ts.ModuleResolutionKind.NodeNext, types:[]};
const host = ts.createCompilerHost(options), get = host.getSourceFile.bind(host), exists = host.fileExists.bind(host), read = host.readFile.bind(host);
host.getSourceFile = (file, version, ...rest) => virtual.has(file) ? ts.createSourceFile(file, virtual.get(file), version, true) : get(file, version, ...rest);
host.fileExists = file => virtual.has(file) || exists(file);
host.readFile = file => virtual.get(file) ?? read(file);
const program = ts.createProgram([probe], options, host), checker = program.getTypeChecker();
const diagnostics = ts.getPreEmitDiagnostics(program).map(d => ({code:d.code, file:d.file?.fileName, start:d.start, message:ts.flattenDiagnosticMessageText(d.messageText,'\n')}));
const differences = [], rendered = [], focused = [];
let count = 0;
for (const node of program.getSourceFile(probe).statements) if (ts.isVariableStatement(node)) for (const d of node.declarationList.declarations) if (d.name.text.startsWith('p_')) {
  const [b,c] = checker.getTypeArguments(checker.getTypeAtLocation(d.name));
  const left = checker.typeToString(b, d, ts.TypeFormatFlags.NoTruncation), right = checker.typeToString(c, d, ts.TypeFormatFlags.NoTruncation);
  const bToC = checker.isTypeAssignableTo(b,c), cToB = checker.isTypeAssignableTo(c,b);
  const row = {name:d.name.text, baseline:left, candidate:right, bToC, cToB};
  if (!bToC || !cToB) differences.push(row);
  if (left !== right) rendered.push(row);
  if (d.name.text === 'p_13_7' || d.name.text === 'p_13_8') focused.push({...row,
    baselineSlots: checker.getTypeArguments(b).map(x=>checker.typeToString(x,d,ts.TypeFormatFlags.NoTruncation)),
    candidateSlots: checker.getTypeArguments(c).map(x=>checker.typeToString(x,d,ts.TypeFormatFlags.NoTruncation))});
  count++;
}
console.log(JSON.stringify({candidateVariant,version:ts.version, histories,incoming,count,diagnostics,differences,rendered,focused,source}, null, 2));
