import { resolve, sep } from 'node:path';
import ts from 'typescript';

export const options: ts.CompilerOptions = {
  strict: true,
  noEmit: true,
  skipLibCheck: true,
  noUncheckedIndexedAccess: true,
  exactOptionalPropertyTypes: true,
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.NodeNext,
  moduleResolution: ts.ModuleResolutionKind.NodeNext,
  types: [],
};

// One host per test process: on-disk files parse once, virtual sources replace their path.
const sourceFiles = new Map<string, ts.SourceFile>();
const virtualSources = new Map<string, string>();
let sharedHost: ts.CompilerHost | undefined;
let previousProgram: ts.Program | undefined;
// cwd-relative like scalePath: __dirname is undefined when Node loads this module for the scripts.
const librarySources = resolve('src') + sep;

/** Drop test-process compiler reuse so large independent cases can be collected. */
export function resetCompilerState(): void {
  previousProgram = undefined;
  sharedHost = undefined;
  sourceFiles.clear();
  virtualSources.clear();
}

function host(): ts.CompilerHost {
  if (sharedHost) return sharedHost;
  const created = ts.createCompilerHost(options);
  const read = created.getSourceFile.bind(created);
  created.getSourceFile = (fileName, languageVersion, onError, shouldCreateNewSourceFile) => {
    const virtual = virtualSources.get(fileName);
    if (virtual !== undefined) return ts.createSourceFile(fileName, virtual, languageVersion, true);
    const cached = sourceFiles.get(fileName);
    if (cached && !shouldCreateNewSourceFile) return cached;
    const file = read(fileName, languageVersion, onError, shouldCreateNewSourceFile);
    if (file) sourceFiles.set(fileName, file);
    return file;
  };
  return sharedHost = created;
}

function program(roots: readonly string[]): ts.Program {
  return previousProgram = ts.createProgram([...roots], options, host(), previousProgram);
}

export function compilerProgram(path: string, source?: string): ts.Program {
  if (source === undefined) virtualSources.delete(path); else virtualSources.set(path, source);
  return program([path]);
}

// The library itself is checked by `npm run typecheck`; fixtures only need their own files.
function fixtureFiles(compiled: ts.Program): readonly ts.SourceFile[] {
  return compiled.getSourceFiles().filter(file => !file.isDeclarationFile && !file.fileName.startsWith(librarySources));
}

export function diagnostics(path: string, source?: string): readonly ts.Diagnostic[] {
  const compiled = compilerProgram(path, source);
  return fixtureFiles(compiled).flatMap(file => ts.getPreEmitDiagnostics(compiled, file));
}

/** Compile many independent fixtures in one program; each path keeps only its own file's diagnostics. */
export function diagnosticsByFile(paths: readonly string[]): Map<string, readonly ts.Diagnostic[]> {
  for (const path of paths) virtualSources.delete(path);
  const compiled = program(paths);
  return new Map(paths.map(path => [path, ts.getPreEmitDiagnostics(compiled, compiled.getSourceFile(path))]));
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
    calls = groups.map((_, index) => `.register(group${index})`).join('\n');
  } else if (form === 'chained') {
    calls = entries.map(entry => `.register({${entry}})`).join('\n');
  } else {
    calls = `.register({${entries.join(',\n')}})`;
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
const bag = DiBag.createBuilder()${calls}.build();
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
      return 'DiBag.fromFunction([missingFinalToken], value => value + 1)';
    }
    if (index === count - 1 && scenario === 'mismatched-invariant-service') {
      return "DiBag.fromFunction([incompatibleFinalInput], value => typeof value === 'number' ? value + 1 : value.length)";
    }
    return `DiBag.fromFunction([token${index - 1}], value => value + 1)`;
  };
  const boundary = '/* token-scale-boundary */';
  let graph: string;
  if (form === 'bindings') {
    const calls = Array.from({ length: count }, (_, index) => {
      const marker = scenario === 'mismatched-invariant-service' && index === count - 1 ? ` ${boundary}` : '';
      return `  .register(token${index}, ${provider(index)})${marker}`;
    });
    const graphMarker = scenario === 'missing-final-token' ? ` ${boundary}` : '';
    graph = `const graph = DiBag.createBuilder()${graphMarker}\n${calls.join('\n')}\n  .build();`;
  } else {
    const modules = Array.from({ length: count }, (_, index) =>
      `const module${index} = DiBag.createBuilder().register(token${index}, ${provider(index)}).buildModule([token${index}]);`,
    );
    const installs = Array.from({ length: count }, (_, index) => {
      const marker = scenario === 'mismatched-invariant-service' && index === count - 1 ? ` ${boundary}` : '';
      return `  .installModule(module${index})${marker}`;
    });
    const graphMarker = scenario === 'missing-final-token' ? ` ${boundary}` : '';
    graph = `${modules.join('\n')}\nconst graph = DiBag.createBuilder()${graphMarker}\n${installs.join('\n')}\n.build();`;
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

/**
 * A library-free fluent chain of `count` calls. It imports the library without using it so the
 * program contains `src` and the checker visits it first, as it does for every library case:
 * the same chain compiled alone overflows at 575 calls where this one passes at 1,000, because
 * V8's optimized checker frames are smaller than its interpreted ones.
 */
export function controlScaleSource(count: number) {
  if (!Number.isInteger(count) || count < 1) throw new Error('control scale count must be at least one');
  const calls = Array.from({ length: count }, (_, index) => `.register({ svc${index}: () => ${index} })`).join('\n');
  return `import { DiBag } from '../src';
const seed: unknown = DiBag;
declare const builder: { register(more: object): typeof builder; build(): { resolve(key: string): number } };
const bag = builder${calls}.build();
const last: number = bag.resolve('svc${count - 1}');
`;
}

/** `count` linearly dependent providers in reusable named modules of 50, installed into one host; the fault opens the last module. */
export function namedModuleScaleSource(count: number, scenario: ScaleCase = 'valid') {
  if (!Number.isInteger(count) || count < 50) throw new Error('named module scale count must be at least 50');
  const groups = Math.ceil(count / 50);
  if (scenario !== 'valid' && groups < 2) throw new Error('negative named module scenarios need at least two modules');
  const fault = (groups - 1) * 50;
  const modules = Array.from({ length: groups }, (_, group) => {
    const size = Math.min(50, count - group * 50);
    const entries = Array.from({ length: size }, (_, offset) => {
      const index = group * 50 + offset;
      if (index === 0) return 'svc0: () => 1';
      const dependency = scenario === 'missing' && index === fault ? 'missingFinal' : `svc${index - 1}`;
      const shape = scenario === 'wrong-shape' && index === fault ? 'string' : 'number';
      return `svc${index}: ({ ${dependency} }: { ${dependency}: ${shape} }) => ${shape === 'string' ? `${dependency}.length` : `${dependency} + 1`}`;
    });
    const names = Array.from({ length: size }, (_, offset) => `'svc${group * 50 + offset}'`).join(', ');
    return `const feature${group} = DiBag.createBuilder().register({ ${entries.join(',\n')} }).buildModule([${names}]);`;
  });
  return `import { DiBag } from '../src';
${modules.join('\n')}
const bag = DiBag.createBuilder()${modules.map((_, index) => `.installModule(feature${index})`).join('\n')}.build();
const first: number = bag.resolve('svc0');
const middle: number = bag.resolve('svc${Math.floor(count / 2)}');
const last: number = bag.resolve('svc${count - 1}');
const reused = DiBag.createBuilder().installModule(feature0).build();
const reusableResult: number = reused.resolve('svc49');
`;
}
