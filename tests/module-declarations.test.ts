import { expect, test } from 'bun:test';
import { resolve } from 'node:path';
import ts from 'typescript';
import { options } from './compiler';

const producer = resolve(__dirname, 'types/module-erasure/feature.ts');
const consumer = resolve(__dirname, 'types/module-erasure/consumer.ts');
const declarationPath = producer.replace(/\.ts$/, '.d.ts');

let emitted: string | undefined;
function emitDeclaration(): string {
  if (emitted !== undefined) return emitted;
  const output = resolve(__dirname, 'generated-module-erasure');
  const emitOptions: ts.CompilerOptions = { ...options, noEmit: false, declaration: true, emitDeclarationOnly: true, rootDir: resolve(__dirname, '..'), outDir: output };
  const declarations = new Map<string, string>();
  const host = ts.createCompilerHost(emitOptions);
  host.writeFile = (name, text) => { declarations.set(name, text); };
  const program = ts.createProgram([producer], emitOptions, host);
  const result = program.emit();
  expect([...ts.getPreEmitDiagnostics(program), ...result.diagnostics].map(error => ts.flattenDiagnosticMessageText(error.messageText, '\n'))).toEqual([]);
  const declaration = declarations.get(resolve(output, 'tests/types/module-erasure/feature.d.ts'));
  expect(declaration).toBeDefined();
  return emitted = declaration!;
}

// Private keys may survive only as quoted values (`consumer`, `root`, `export`, `reach.key`) that give host
// diagnostics their provenance; never as a type name, identifier, or property key.
test('a sealed module declaration names private registrations only inside quoted constraint values', () => {
  const declaration = emitDeclaration();
  const unquoted = declaration.replace(/"[^"\n]*"|'[^'\n]*'/g, '""');
  for (const name of ['privateCache', 'privateHelper', 'PrivateCacheShape']) expect(unquoted).not.toContain(name);
  expect(declaration).toContain('"privateHelper"');
  expect(declaration).toMatch(/readonly root: "privateHelper"/);
});

test('a sealed module declaration is compact', () => {
  const declaration = emitDeclaration();
  console.log(`module-erasure feature.d.ts: ${declaration.length} bytes`);
  expect(declaration.length).toBeLessThan(2_500);
});

test('the consumer type-checks against the emitted declaration alone', () => {
  const declaration = emitDeclaration();
  const consumerHost = ts.createCompilerHost(options);
  const exists = consumerHost.fileExists.bind(consumerHost);
  const read = consumerHost.getSourceFile.bind(consumerHost);
  consumerHost.fileExists = name => name === producer ? false : name === declarationPath ? true : exists(name);
  consumerHost.getSourceFile = (name, version, onError, fresh) => name === producer ? undefined
    : name === declarationPath ? ts.createSourceFile(name, declaration, version, true) : read(name, version, onError, fresh);
  const program = ts.createProgram([consumer], options, consumerHost);
  expect(program.getSourceFile(producer)).toBeUndefined();
  expect(ts.getPreEmitDiagnostics(program).map(error => ts.flattenDiagnosticMessageText(error.messageText, '\n'))).toEqual([]);
});
