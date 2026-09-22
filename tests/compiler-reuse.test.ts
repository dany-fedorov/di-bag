// tests/compiler-reuse.test.ts
import { expect, test } from 'bun:test';
import { resolve } from 'node:path';
import { compilerProgram, describeDiagnostic, diagnostics, diagnosticsByFile, resetCompilerState } from './compiler';

const fixture = resolve(__dirname, 'types/negative/fork-missing.ts');
const sibling = resolve(__dirname, 'types/negative/fork-extra.ts');
const librarySource = resolve(__dirname, '../src/di-bag.ts');

test('consecutive programs share parsed library source files', () => {
  const first = compilerProgram(fixture);
  const second = compilerProgram(sibling);
  expect(second.getSourceFile(librarySource)).toBe(first.getSourceFile(librarySource)!);
});

test('reset releases parsed sources and preserves diagnostics for a new virtual compilation', () => {
  const first = compilerProgram(fixture);
  const firstLibrarySource = first.getSourceFile(librarySource);
  const before = diagnostics(fixture).map(describeDiagnostic);
  const path = resolve(__dirname, 'generated-compiler-reset.ts');
  const invalid = "import { DiBag } from '../src';\nconst value: string = DiBag.createBuilder().withServices({ a: () => 1 }).buildContainer().resolve('a');\n";

  resetCompilerState();

  const second = compilerProgram(fixture);
  expect(second.getSourceFile(librarySource)).not.toBe(firstLibrarySource);
  expect(diagnostics(fixture).map(describeDiagnostic)).toEqual(before);
  expect(diagnostics(path, invalid).map(error => describeDiagnostic(error).code)).toEqual([2322]);
});

test('a batch program reports the same per-file diagnostics as a single-root program', () => {
  const single = diagnosticsByFile([fixture]).get(fixture)!.map(describeDiagnostic);
  const batch = diagnosticsByFile([fixture, sibling]);
  expect(batch.get(fixture)!.map(describeDiagnostic)).toEqual(single);
  expect(batch.get(sibling)!.length).toBeGreaterThan(0);
  expect(batch.get(sibling)!.every(error => error.file?.fileName === sibling)).toBe(true);
});

test('a virtual source at a reused path is recompiled', () => {
  const path = resolve(__dirname, 'generated-compiler-reuse.ts');
  const valid = "import { DiBag } from '../src';\nconst value: number = DiBag.createBuilder().withServices({ a: () => 1 }).buildContainer().resolve('a');\n";
  const invalid = valid.replace('const value: number', 'const value: string');
  expect(diagnostics(path, valid)).toEqual([]);
  expect(diagnostics(path, invalid).map(error => describeDiagnostic(error).code)).toEqual([2322]);
  expect(diagnostics(path, valid)).toEqual([]);
});

test('diagnostics for a consumer fixture still include its producer file', () => {
  // types/plugins-consumer.ts imports types/plugins.ts; both must be checked, src/ is not.
  const consumer = resolve(__dirname, 'types/plugins-consumer.ts');
  const program = compilerProgram(consumer);
  expect(program.getSourceFile(resolve(__dirname, 'types/plugins.ts'))).toBeDefined();
  expect(diagnostics(consumer)).toEqual([]);
});
