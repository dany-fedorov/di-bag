import { cpSync, mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { scaleSource, scaleBoundaryLine, tokenScaleSource, tokenScaleBoundaryLine } from '../tests/compiler.ts';
import type { ScaleCase, ScaleForm, TokenScaleCase, TokenScaleForm } from '../tests/compiler.ts';
import { acceptDiagnostics, type MatrixCase } from './benchmark-result.ts';
import { compileNative, type NativeCompiler } from './native-compiler.ts';

export async function nativeScale(root: string, compiler: NativeCompiler, item: MatrixCase): Promise<Record<string, unknown>> {
  const directory = mkdtempSync(join(tmpdir(), 'di-bag-native-scale-'));
  try {
    cpSync(join(root, 'src'), join(directory, 'src'), { recursive: true });
    mkdirSync(join(directory, 'tests'));
    const tokens = item.form === 'bindings' || item.form === 'modules';
    const source = tokens ? tokenScaleSource(item.count, item.form as TokenScaleForm, item.scenario as TokenScaleCase)
      : scaleSource(item.count, item.form as ScaleForm, item.scenario as ScaleCase);
    const boundaryLine = tokens ? tokenScaleBoundaryLine(source) : scaleBoundaryLine(source, item.count, item.form as ScaleForm, item.scenario as ScaleCase);
    const file = join(directory, 'tests', tokens ? 'generated-token-scale.ts' : 'generated-type-scale.ts');
    writeFileSync(file, source);
    const hash = createHash('sha256');
    const sourceFiles = (folder: string): string[] => readdirSync(join(directory, 'src', folder), { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? sourceFiles(join(folder, entry.name)) : [join(folder, entry.name)]);
    for (const file of sourceFiles('').filter(file => file.endsWith('.ts')).sort()) {
      hash.update(file); hash.update(new Uint8Array(readFileSync(join(directory, 'src', file))));
    }
    const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
    const result = await compileNative(compiler, directory, [file], { skipLibCheck: true });
    const accepted = result.checked && acceptDiagnostics(result.diagnostics, item, file, boundaryLine);
    return { ...item, ...result, accepted, boundaryLine, typescript: compiler.version, compiler,
      sourceCommit, sourceSha256: hash.digest('hex'), generatedSha256: createHash('sha256').update(source).digest('hex'),
      nativeMetrics: result.metrics,
      ...(!accepted ? { failureReason: !result.checked ? 'native process or output did not pass checked completion' : 'native diagnostics did not satisfy original boundary contract' } : {}) };
  } finally { rmSync(directory, { recursive: true, force: true }); }
}
