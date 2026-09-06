import { expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';

const options: ts.CompilerOptions = {
  strict: true,
  noEmit: true,
  skipLibCheck: true,
  noUncheckedIndexedAccess: true,
  exactOptionalPropertyTypes: true,
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.CommonJS,
  types: [],
};

function diagnostics(path: string) {
  const program = ts.createProgram([path], options);
  return ts.getPreEmitDiagnostics(program);
}

test('valid composition preserves inferred values and explicit promise edges', () => {
  const errors = diagnostics(resolve(__dirname, 'types/positive.ts'));
  expect(
    errors.map((error) =>
      ts.flattenDiagnosticMessageText(error.messageText, '\n'),
    ),
  ).toEqual([]);
});

for (const name of readdirSync(resolve(__dirname, 'types/negative')).filter(
  (name) => name.endsWith('.ts'),
)) {
  test(`type rejection: ${name}`, () => {
    const path = resolve(__dirname, 'types/negative', name);
    const source = readFileSync(path, 'utf8');
    const expected = /\/\/ diagnostic: (.+)/.exec(source)?.[1];
    expect(expected).toBeDefined();
    const errors = diagnostics(path);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.every((error) => error.file?.fileName === path)).toBe(true);
    const messages = errors
      .map((error) => ts.flattenDiagnosticMessageText(error.messageText, '\n'))
      .join('\n');
    expect(messages).toContain(expected!);
  });
}
