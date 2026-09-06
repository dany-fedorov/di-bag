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

export function diagnostics(path: string, source?: string) {
  const host = ts.createCompilerHost(options);
  const originalGetSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (fileName, languageVersion, onError, shouldCreateNewSourceFile) =>
    fileName === path && source !== undefined
      ? ts.createSourceFile(fileName, source, languageVersion, true)
      : originalGetSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile);
  return ts.getPreEmitDiagnostics(ts.createProgram([path], options, host));
}

export function describeDiagnostic(error: ts.Diagnostic) {
  const position = error.file && error.start !== undefined
    ? error.file.getLineAndCharacterOfPosition(error.start)
    : undefined;
  return {
    code: error.code,
    file: error.file?.fileName,
    line: position === undefined ? undefined : position.line + 1,
    column: position === undefined ? undefined : position.character + 1,
    message: ts.flattenDiagnosticMessageText(error.messageText, '\n'),
  };
}

export type ScaleForm = 'bulk' | 'chained' | 'grouped' | 'replacement';
export type ScaleCase = 'valid' | 'missing' | 'wrong-shape';
export const scalePath = resolve('tests/generated-type-scale.ts');

/** Real public calls and checked consumer assignments, with no widening casts. */
export function scaleSource(
  count: number,
  form: ScaleForm,
  scenario: ScaleCase = 'valid',
) {
  const entries = Array.from({ length: count }, (_, index) => {
    if (index === 0) return 'svc0: () => 1';
    const dependency = form !== 'replacement' && scenario === 'missing' && index === count - 1
      ? 'missingFinal'
      : `svc${index - 1}`;
    const shape = form !== 'replacement' && scenario === 'wrong-shape' && index === Math.floor(count / 2)
      ? 'string'
      : 'number';
    const value = shape === 'string' ? `${dependency}.length` : `${dependency} + 1`;
    return `svc${index}: ({${dependency}}: {${dependency}: ${shape}}) => ${value}`;
  });
  let declarations = '';
  let calls: string;
  if (form === 'grouped') {
    // Ordinary reusable registration groups, not a nominal module API.
    const groups = Array.from({ length: Math.ceil(count / 50) }, (_, index) =>
      `const group${index} = {${entries.slice(index * 50, (index + 1) * 50).join(',\n')}};`,
    );
    declarations = groups.join('\n');
    calls = groups.map((_, index) => `.add(group${index})`).join('\n');
  } else if (form === 'chained') {
    calls = entries.map(entry => `.add({${entry}})`).join('\n');
  } else {
    calls = `.add({${entries.join(',\n')}})`;
    if (form === 'replacement') {
      calls += entries.map((_, index) => {
        const factory = scenario === 'missing' && index === count - 1
          ? '({missingFinal}: {missingFinal: number}) => missingFinal + 1'
          : scenario === 'wrong-shape' && index === Math.floor(count / 2)
            ? "() => 'wrong'"
            : `() => ${index + 2}`;
        return `.replace('svc${index}', ${factory})`;
      }).join('\n');
    }
  }
  return `import { DiBag } from '../src';
${declarations}
const bag = DiBag.begin()${calls}.end();
const first: number = bag.resolve('svc0');
const middle: number = bag.resolve('svc${Math.floor(count / 2)}');
const last: number = bag.resolve('svc${count - 1}');
`;
}
