import { cpSync, mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { scaleSource, scaleBoundaryLine, tokenScaleSource, tokenScaleBoundaryLine } from '../tests/compiler.ts';
import type { ScaleCase, ScaleForm, TokenScaleCase, TokenScaleForm } from '../tests/compiler.ts';
import { acceptDiagnostics, type MatrixCase } from './benchmark-result.ts';
import { compileNative, type NativeCompiler } from './native-compiler.ts';

export type NativeGenerated = { fileName: 'generated-type-scale.ts' | 'generated-token-scale.ts'; source: string };

/** Compile one generated file against a copy of `src` in a temporary native project; the caller decides acceptance. */
export async function compileGeneratedNative(root: string, compiler: NativeCompiler, generated: NativeGenerated) {
  const directory = mkdtempSync(join(tmpdir(), 'di-bag-native-scale-'));
  try {
    cpSync(join(root, 'src'), join(directory, 'src'), { recursive: true });
    mkdirSync(join(directory, 'tests'));
    const file = join(directory, 'tests', generated.fileName);
    writeFileSync(file, generated.source);
    const hash = createHash('sha256');
    const sourceFiles = (folder: string): string[] => readdirSync(join(directory, 'src', folder), { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? sourceFiles(join(folder, entry.name)) : [join(folder, entry.name)]);
    for (const source of sourceFiles('').filter(name => name.endsWith('.ts')).sort()) {
      hash.update(source); hash.update(new Uint8Array(readFileSync(join(directory, 'src', source))));
    }
    const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
    const result = await compileNative(compiler, directory, [file], { skipLibCheck: true });
    return { ...result, file, typescript: compiler.version, compiler, sourceCommit, sourceSha256: hash.digest('hex'),
      generatedSha256: createHash('sha256').update(generated.source).digest('hex'), nativeMetrics: result.metrics };
  } finally { rmSync(directory, { recursive: true, force: true }); }
}

export async function nativeScale(root: string, compiler: NativeCompiler, item: MatrixCase): Promise<Record<string, unknown>> {
  const tokens = item.form === 'bindings' || item.form === 'modules';
  const source = tokens ? tokenScaleSource(item.count, item.form as TokenScaleForm, item.scenario as TokenScaleCase)
    : scaleSource(item.count, item.form as ScaleForm, item.scenario as ScaleCase);
  const boundaryLine = tokens ? tokenScaleBoundaryLine(source) : scaleBoundaryLine(source, item.count, item.form as ScaleForm, item.scenario as ScaleCase);
  const { file, ...result } = await compileGeneratedNative(root, compiler, { fileName: tokens ? 'generated-token-scale.ts' : 'generated-type-scale.ts', source });
  const accepted = result.checked && acceptDiagnostics(result.diagnostics, item, file, boundaryLine);
  return { ...item, ...result, accepted, boundaryLine,
    ...(!accepted ? { failureReason: !result.checked ? 'native process or output did not pass checked completion' : 'native diagnostics did not satisfy original boundary contract' } : {}) };
}
