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

export function compilerProgram(path: string, source?: string): ts.Program {
  const host = ts.createCompilerHost(options);
  const originalGetSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (fileName, languageVersion, onError, shouldCreateNewSourceFile) =>
    fileName === path && source !== undefined
      ? ts.createSourceFile(fileName, source, languageVersion, true)
      : originalGetSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile);
  return ts.createProgram([path], options, host);
}

export function diagnostics(path: string, source?: string) {
  return ts.getPreEmitDiagnostics(compilerProgram(path, source));
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

export type TokenScaleForm = 'bindings' | 'modules';
export type TokenScaleCase = 'valid' | 'missing-final-token' | 'mismatched-invariant-service';
export const tokenScalePath = resolve('tests/generated-token-scale.ts');

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

export function scaleBoundaryLine(
  source: string,
  count: number,
  form: ScaleForm,
  scenario: ScaleCase,
) {
  if (scenario === 'valid') return undefined;
  const graphLine = source.split('\n').findIndex(line => line.startsWith('const bag =')) + 1;
  if (graphLine === 0) throw new Error('missing generated graph boundary');
  if (scenario === 'missing' || form === 'bulk') return graphLine;
  const changed = Math.floor(count / 2);
  return graphLine + (
    form === 'chained'
      ? changed
      : form === 'grouped'
        ? Math.floor(changed / 50)
        : count - 1 + changed
  );
}

/** One hundred real token bindings or distinct modules, with a marked rejection boundary. */
export function tokenScaleSource(
  count: number,
  form: TokenScaleForm,
  scenario: TokenScaleCase = 'valid',
) {
  if (!Number.isInteger(count) || count < 2) throw new Error('token scale count must be at least two');
  const declarations = Array.from({ length: count }, (_, index) =>
    `const key${index} = Symbol('service${index}');\nconst token${index} = DiBag.token(key${index}).of<number>();`,
  );
  if (scenario === 'missing-final-token') {
    declarations.push("const missingFinalKey = Symbol('missingFinal');\nconst missingFinalToken = DiBag.token(missingFinalKey).of<number>();");
  }
  if (scenario === 'mismatched-invariant-service') {
    declarations.push(`const incompatibleFinalInput = DiBag.token(key${count - 2}).of<number | string>();`);
  }
  const provider = (index: number) => {
    if (index === 0) return '() => 1';
    if (index === count - 1 && scenario === 'missing-final-token') {
      return 'DiBag.fromTokens([missingFinalToken], value => value + 1)';
    }
    if (index === count - 1 && scenario === 'mismatched-invariant-service') {
      return "DiBag.fromTokens([incompatibleFinalInput], value => typeof value === 'number' ? value + 1 : value.length)";
    }
    return `DiBag.fromTokens([token${index - 1}], value => value + 1)`;
  };
  const boundary = '/* token-scale-boundary */';
  let graph: string;
  if (form === 'bindings') {
    const calls = Array.from({ length: count }, (_, index) => {
      const marker = scenario === 'mismatched-invariant-service' && index === count - 1 ? ` ${boundary}` : '';
      return `  .bind(token${index}, ${provider(index)})${marker}`;
    });
    const graphMarker = scenario === 'missing-final-token' ? ` ${boundary}` : '';
    graph = `const graph = DiBag.begin()${graphMarker}\n${calls.join('\n')}\n  .end();`;
  } else {
    const modules = Array.from({ length: count }, (_, index) =>
      `const module${index} = DiBag.module().bind(token${index}, ${provider(index)}).exports([token${index}]);`,
    );
    const installs = Array.from({ length: count }, (_, index) => {
      const marker = scenario === 'mismatched-invariant-service' && index === count - 1 ? ` ${boundary}` : '';
      return `  .install(module${index})${marker}`;
    });
    const graphMarker = scenario === 'missing-final-token' ? ` ${boundary}` : '';
    graph = `${modules.join('\n')}\nconst graph = DiBag.begin()${graphMarker}\n${installs.join('\n')}\n  .end();`;
  }
  return `import { DiBag } from '../src';
${declarations.join('\n')}
${graph}
const result: number = graph.resolve(token${count - 1});
`;
}

export function tokenScaleBoundaryLine(source: string) {
  const lines = source.split('\n');
  const index = lines.findIndex(line => line.includes('token-scale-boundary'));
  return index === -1 ? undefined : index + 1;
}
