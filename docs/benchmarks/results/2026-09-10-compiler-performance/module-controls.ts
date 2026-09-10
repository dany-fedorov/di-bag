import ts from 'typescript';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { compilerProgram, describeDiagnostic, scalePath, scaleSource } from '../../../../tests/compiler.ts';
import { compileNative, resolveNative } from '../../../../scripts/native-compiler.ts';
const [lane, countText, form, kind] = process.argv.slice(2);
if (!['classic', 'native'].includes(lane ?? '') || !['100', '500', '1000'].includes(countText ?? '') || !['chained', 'replacement'].includes(form ?? '') || !['syntax', 'generic-history'].includes(kind ?? '')) throw new Error('invalid control');
const count = Number(countText);
const simple = `interface Chain { add(value: object): Chain; replace(key: string, value: unknown): Chain; end(): { resolve(key: string): number }; }\ndeclare const DiBag: { begin(): Chain };`;
const generic = `type Entry = { key: PropertyKey; value: unknown };
type Entries<N> = { [K in keyof N]: { key: K; value: N[K] } }[keyof N];
type From<E extends Entry> = { [P in E as P['key']]: P['value'] };
type Output<F> = F extends (...args: never[]) => infer O ? O : never;
interface Chain<E extends Entry> {
 add<N>(value: N): Chain<E | Entries<N>>;
 replace<K extends string, V>(key: K, value: V): Chain<Exclude<E, { key: K }> | { key: K; value: V }>;
 end(): { resolve<K extends keyof From<E>>(key: K): Output<From<E>[K]> };
}
declare const DiBag: { begin(): Chain<never> };`;
const source = 'export {};\n' + scaleSource(count, form as 'chained' | 'replacement').replace("import { DiBag } from '../src';", kind === 'syntax' ? simple : generic);
const directory = resolve('docs/benchmarks/results/2026-09-10-compiler-performance/module-controls', `${lane}-${count}-${form}-${kind}`);
mkdirSync(directory, { recursive: true });
writeFileSync(resolve(directory, 'source.ts'), source);
const identity = { lane, count, form, kind, generatedSha256: createHash('sha256').update(source).digest('hex') };
if (lane === 'classic') {
 const start = performance.now();
 // The same virtual source path and compilerProgram API as the original worker.
 const program = compilerProgram(scalePath, source);
 const diagnostics = ts.getPreEmitDiagnostics(program).map(describeDiagnostic);
 console.log(JSON.stringify({ ...identity, typescript: ts.version, node: process.version, diagnostics, accepted: diagnostics.length === 0, instantiations: program.getInstantiationCount(), milliseconds: performance.now() - start, maxRssMiB: process.resourceUsage().maxRSS / 1024 }));
} else {
 const compiler = await resolveNative(process.cwd());
 const result = await compileNative(compiler, directory, [resolve(directory, 'source.ts')], { skipLibCheck: true });
 console.log(JSON.stringify({ ...identity, compiler, ...result, accepted: result.checked && result.diagnostics.length === 0 }));
}
