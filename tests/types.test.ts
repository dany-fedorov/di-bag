import { expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import { diagnostics, describeDiagnostic } from './compiler';
import { matchDiagnosticMarkers } from './diagnostic-markers';

test('observers retain exact inferred cross-file contracts', () => {
  expect(diagnostics(resolve(__dirname, 'types/observers-consumer.ts')).map(error =>
    ts.flattenDiagnosticMessageText(error.messageText, '\n'))).toEqual([]);
});

test('contributions retain exact inferred cross-file contracts', () => {
  expect(diagnostics(resolve(__dirname, 'types/contributions-consumer.ts')).map(error =>
    ts.flattenDiagnosticMessageText(error.messageText, '\n'))).toEqual([]);
});

test('aliases retain exact inferred cross-file contracts', () => {
  expect(diagnostics(resolve(__dirname, 'types/aliases-consumer.ts')).map(error =>
    ts.flattenDiagnosticMessageText(error.messageText, '\n'))).toEqual([]);
});

test('dependency references retain exact inferred cross-file contracts', () => {
  expect(diagnostics(resolve(__dirname, 'types/dependency-references-consumer.ts')).map(error =>
    ts.flattenDiagnosticMessageText(error.messageText, '\n'))).toEqual([]);
});

test('composition adapters retain exact inferred cross-file contracts', () => {
  expect(diagnostics(resolve(__dirname, 'types/composition-adapters-consumer.ts')).map(error =>
    ts.flattenDiagnosticMessageText(error.messageText, '\n'))).toEqual([]);
});

test('selected scopes retain exact inferred cross-file contracts', () => {
  expect(diagnostics(resolve(__dirname, 'types/selected-scopes-consumer.ts')).map(error =>
    ts.flattenDiagnosticMessageText(error.messageText, '\n'))).toEqual([]);
});

test('startup and contextual providers retain exact inferred cross-file contracts', () => {
  expect(diagnostics(resolve(__dirname, 'types/startup-consumer.ts')).map(error =>
    ts.flattenDiagnosticMessageText(error.messageText, '\n'))).toEqual([]);
});

test('lifetime declarations retain exact inferred cross-file contracts', () => {
  expect(diagnostics(resolve(__dirname, 'types/lifetimes-consumer.ts')).map(error =>
    ts.flattenDiagnosticMessageText(error.messageText, '\n'))).toEqual([]);
});

for (const fixture of ['lifetimes', 'composition-adapters', 'dependency-references', 'aliases', 'contributions', 'observers']) test(`${fixture} inferred exports survive declaration consumption`, () => {
  const producerPath = resolve(__dirname, `types/${fixture}.ts`);
  const consumerPath = resolve(__dirname, `types/${fixture}-consumer.ts`);
  const declarationPath = producerPath.replace(/\.ts$/, '.d.ts');
  const output = resolve(__dirname, `generated-${fixture}-declarations`);
  const options: ts.CompilerOptions = {
    strict: true, noUncheckedIndexedAccess: true, exactOptionalPropertyTypes: true,
    skipLibCheck: true, types: [], target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext,
    declaration: true, emitDeclarationOnly: true, rootDir: resolve(__dirname, '..'), outDir: output,
  };
  const declarations = new Map<string, string>();
  const host = ts.createCompilerHost(options);
  host.writeFile = (name, text) => { declarations.set(name, text); };
  const producer = ts.createProgram([producerPath], options, host);
  const emitted = producer.emit();
  expect([...ts.getPreEmitDiagnostics(producer), ...emitted.diagnostics].map(error =>
    ts.flattenDiagnosticMessageText(error.messageText, '\n'))).toEqual([]);
  const declaration = declarations.get(resolve(output, `tests/types/${fixture}.d.ts`));
  expect(declaration).toBeDefined();
  const consumerOptions = { ...options, noEmit: true, emitDeclarationOnly: false };
  const consumerHost = ts.createCompilerHost(consumerOptions);
  const exists = consumerHost.fileExists.bind(consumerHost);
  const read = consumerHost.getSourceFile.bind(consumerHost);
  consumerHost.fileExists = name => name === producerPath ? false : name === declarationPath ? true : exists(name);
  consumerHost.getSourceFile = (name, version, onError, fresh) => name === producerPath ? undefined
    : name === declarationPath ? ts.createSourceFile(name, declaration!, version, true) : read(name, version, onError, fresh);
  const consumer = ts.createProgram([consumerPath], consumerOptions, consumerHost);
  expect(consumer.getSourceFile(producerPath)).toBeUndefined();
  expect(consumer.getSourceFile(declarationPath)).toBeDefined();
  expect(ts.getPreEmitDiagnostics(consumer).map(error => ts.flattenDiagnosticMessageText(error.messageText, '\n'))).toEqual([]);
});

test('acquisition modes retain exact acquired values across inferred exports', () => {
  expect(diagnostics(resolve(__dirname, 'types/acquisition-mode-consumer.ts')).map(error =>
    ts.flattenDiagnosticMessageText(error.messageText, '\n'))).toEqual([]);
});

test('token modules preserve exact cross-file contracts', () => {
  expect(diagnostics(resolve(__dirname, 'types/token-modules/consumer.ts')).map(error =>
    ts.flattenDiagnosticMessageText(error.messageText, '\n'))).toEqual([]);
});

test('public token composition preserves exact outputs and frames', () => {
  expect(diagnostics(resolve(__dirname, 'types/tokens.ts')).map(error =>
    ts.flattenDiagnosticMessageText(error.messageText, '\n'))).toEqual([]);
});

test('token contracts preserve exact identities and provider graphs', () => {
  expect(diagnostics(resolve(__dirname, 'types/token-contracts.ts')).map(error =>
    ts.flattenDiagnosticMessageText(error.messageText, '\n'))).toEqual([]);
});

test('replacement context preserves exact contracts from surviving consumers', () => {
  expect(diagnostics(resolve(__dirname, 'types/replacement-context.ts')).map(error =>
    ts.flattenDiagnosticMessageText(error.messageText, '\n'))).toEqual([]);
});

test('incremental checks preserve forward, replacement and frame contracts', () => {
  expect(diagnostics(resolve(__dirname, 'types/incremental.ts')).map(error =>
    ts.flattenDiagnosticMessageText(error.messageText, '\n'))).toEqual([]);
});

test('builder views preserve exact accepted registration histories', () => {
  expect(diagnostics(resolve(__dirname, 'types/builder-views.ts')).map(error =>
    ts.flattenDiagnosticMessageText(error.messageText, '\n'))).toEqual([]);
});

test('supported replacement wrappers and reflected methods stay exact and non-any', () => {
  expect(diagnostics(resolve(__dirname, 'types/replacement-supported.ts')).map(error =>
    ts.flattenDiagnosticMessageText(error.messageText, '\n'))).toEqual([]);
});

test('modern inline inference retains exact contracts', () => {
  expect(diagnostics(resolve(__dirname, 'types/modern-inline-consumer.ts')).map(error =>
    ts.flattenDiagnosticMessageText(error.messageText, '\n'))).toEqual([]);
});

test('box adapters preserve exact modes, requirements and frames', () => {
  expect(diagnostics(resolve(__dirname, 'types/box-adapters.ts')).map(error =>
    ts.flattenDiagnosticMessageText(error.messageText, '\n'))).toEqual([]);
});

test('typed provider metadata survives checked composition and inspection', () => {
  expect(diagnostics(resolve(__dirname, 'types/providers.ts')).map(error =>
    ts.flattenDiagnosticMessageText(error.messageText, '\n'))).toEqual([]);
});

test('named modules preserve contracts across a file boundary', () => {
  expect(diagnostics(resolve(__dirname, 'types/modules/consumer.ts')).map(error =>
    ts.flattenDiagnosticMessageText(error.messageText, '\n'))).toEqual([]);
});

test('valid composition preserves inferred values and explicit promise edges', () => {
  const errors = diagnostics(resolve(__dirname, 'types/positive.ts'));
  expect(
    errors.map((error) =>
      ts.flattenDiagnosticMessageText(error.messageText, '\n'),
    ),
  ).toEqual([]);
});

test('registration boundaries preserve selected keys and exact factory types', () => {
  const errors = diagnostics(resolve(__dirname, 'types/boundaries.ts'));
  expect(
    errors.map(error => ts.flattenDiagnosticMessageText(error.messageText, '\n')),
  ).toEqual([]);
});

test('scope preserves exact inferred contracts across a source boundary', () => {
  expect(diagnostics(resolve(__dirname, 'types/scopes-consumer.ts')).map(error =>
    ts.flattenDiagnosticMessageText(error.messageText, '\n'))).toEqual([]);
});

for (const operation of ['add', 'fork', 'disposal']) {
  test(`inline method-returning factories preserve exact types: ${operation}`, () => {
    const errors = diagnostics(
      resolve(__dirname, `types/inline-${operation}.ts`),
    );
    expect(
      errors.map((error) =>
        ts.flattenDiagnosticMessageText(error.messageText, '\n'),
      ),
    ).toEqual([]);
  });
}

for (const name of readdirSync(resolve(__dirname, 'types/negative')).filter(
  (name) => name.endsWith('.ts'),
)) {
  test(`type rejection: ${name}`, () => {
    const path = resolve(__dirname, 'types/negative', name);
    const source = readFileSync(path, 'utf8');
    const expected = [...source.matchAll(/\/\/ diagnostic: (.+)/g)];
    expect(expected.length).toBeGreaterThan(0);
    const errors = diagnostics(path);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.every((error) => error.file?.fileName === path)).toBe(true);
    const matched = matchDiagnosticMarkers(source, path, errors.map(describeDiagnostic));
    expect(matched.missing).toEqual([]); expect(matched.unexpected).toEqual([]);
  });
}
