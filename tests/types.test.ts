import { expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import ts from 'typescript';
import { diagnostics, diagnosticsByFile, describeDiagnostic, options } from './compiler';
import { matchDiagnosticMarkers } from './diagnostic-markers';

test('provider sources retain exact inferred contracts', () => {
  expect(diagnostics(resolve(__dirname, 'types/provider-sources.ts')).map(error =>
    ts.flattenDiagnosticMessageText(error.messageText, '\n'))).toEqual([]);
});

test('provider facade bags retain exact inferred contracts', () => {
  expect(diagnostics(resolve(__dirname, 'types/provider-facades-consumer.ts')).map(error => ts.flattenDiagnosticMessageText(error.messageText, '\n'))).toEqual([]);
});

test('provider source declarations retain exact inferred contracts', () => {
  expect(diagnostics(resolve(__dirname, 'types/provider-sources-consumer.ts')).map(error =>
    ts.flattenDiagnosticMessageText(error.messageText, '\n'))).toEqual([]);
});

test('observers retain exact inferred cross-file contracts', () => {
  expect(diagnostics(resolve(__dirname, 'types/observers-consumer.ts')).map(error =>
    ts.flattenDiagnosticMessageText(error.messageText, '\n'))).toEqual([]);
});

test('plugins retain exact inferred cross-file contracts', () => {
  expect(diagnostics(resolve(__dirname, 'types/plugins-consumer.ts')).map(error =>
    ts.flattenDiagnosticMessageText(error.messageText, '\n'))).toEqual([]);
});

test('final adversarial integration retains exact inferred cross-file contracts', () => {
  expect(diagnostics(resolve(__dirname, 'types/final-adversarial-integration-consumer.ts')).map(error =>
    ts.flattenDiagnosticMessageText(error.messageText, '\n'))).toEqual([]);
});

test('contributions retain exact inferred cross-file contracts', () => {
  expect(diagnostics(resolve(__dirname, 'types/contributions-consumer.ts')).map(error =>
    ts.flattenDiagnosticMessageText(error.messageText, '\n'))).toEqual([]);
});

test('collection tokens retain exact inferred contracts', () => {
  expect(diagnostics(resolve(__dirname, 'types/collection-tokens.ts')).map(error =>
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

test('container derivation retains exact inferred cross-file contracts', () => {
  expect(diagnostics(resolve(__dirname, 'types/container-derivation-consumer.ts')).map(error =>
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

test('singleton default source contract type-checks', () => {
  expect(diagnostics(resolve(__dirname, 'types/singleton-default.ts')).map(error =>
    ts.flattenDiagnosticMessageText(error.messageText, '\n'))).toEqual([]);
});

test('singleton default declaration consumer type-checks', () => {
  expect(diagnostics(resolve(__dirname, 'types/singleton-default-consumer.ts')).map(error =>
    ts.flattenDiagnosticMessageText(error.messageText, '\n'))).toEqual([]);
});

test('requirement-renaming retains exact cross-file contracts', () => {
  expect(diagnostics(resolve(__dirname, 'types/requirement-renaming-consumer.ts')).map(error =>
    ts.flattenDiagnosticMessageText(error.messageText, '\n'))).toEqual([]);
});

for (const fixture of ['lifetimes', 'composition-adapters', 'dependency-references', 'aliases', 'contributions', 'observers', 'plugins', 'final-adversarial-integration', 'portable-factories', 'provider-sources', 'provider-facades', 'container-derivation', 'requirement-renaming', 'singleton-default']) test(`${fixture} inferred exports survive declaration consumption`, () => {
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

test('verifyGraph reports void for buildable graphs and the build failure otherwise', () => {
  expect(diagnostics(resolve(__dirname, 'types/verify-graph.ts')).map(error =>
    ts.flattenDiagnosticMessageText(error.messageText, '\n'))).toEqual([]);
});

test('the DiBagPolicy structuralThenables switch relaxes the compile-time check', () => {
  // Isolated program: the augmentation must not leak into the shared fixture program.
  const path = resolve(__dirname, 'types/isolated/thenable-policy.ts');
  const isolated = ts.createProgram([path], options, ts.createCompilerHost(options));
  expect(ts.getPreEmitDiagnostics(isolated).map(error => ts.flattenDiagnosticMessageText(error.messageText, '\n'))).toEqual([]);
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

test('incremental projection candidates preserve replacement and resolved contracts', () => {
  expect(diagnostics(resolve(__dirname, 'types/incremental-projections.ts')).map(error =>
    ts.flattenDiagnosticMessageText(error.messageText, '\n'))).toEqual([]);
});

test('incremental module installation preserves private, forward, and token contracts', () => {
  expect(diagnostics(resolve(__dirname, 'types/incremental-modules.ts')).map(error =>
    ts.flattenDiagnosticMessageText(error.messageText, '\n'))).toEqual([]);
});

test('incremental module declarations retain exact results and token outputs', () => {
  expect(diagnostics(resolve(__dirname, 'types/incremental-modules-consumer.ts')).map(error =>
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

test('replacement reflection preserves utility soundness and module history', () => {
  expect(diagnostics(resolve(__dirname, 'types/replacement-reflection.ts')).map(error =>
    ts.flattenDiagnosticMessageText(error.messageText, '\n'))).toEqual([]);
});

test('modern inline inference retains exact contracts', () => {
  expect(diagnostics(resolve(__dirname, 'types/modern-inline-consumer.ts')).map(error =>
    ts.flattenDiagnosticMessageText(error.messageText, '\n'))).toEqual([]);
});

test('consolidated API preserves exact mode-dependent contracts', () => {
  expect(diagnostics(resolve(__dirname, 'types/api-renaming.ts')).map(error =>
    ts.flattenDiagnosticMessageText(error.messageText, '\n'))).toEqual([]);
});

test('the 0.5.0 builder shapes infer the same contracts as the 0.4.0 forms', () => {
  expect(diagnostics(resolve(__dirname, 'types/builder-renames.ts')).map(error =>
    ts.flattenDiagnosticMessageText(error.messageText, '\n'))).toEqual([]);
});

test('0.5.0 builder shapes retain declaration contracts', () => {
  expect(diagnostics(resolve(__dirname, 'types/builder-renames-consumer.ts')).map(error =>
    ts.flattenDiagnosticMessageText(error.messageText, '\n'))).toEqual([]);
});

test('native acquisition metadata preserves exact outputs, requirements and frames', () => {
  expect(diagnostics(resolve(__dirname, 'types/acquisition-metadata.ts')).map(error =>
    ts.flattenDiagnosticMessageText(error.messageText, '\n'))).toEqual([]);
});

test('typed provider metadata survives checked composition and inspection', () => {
  expect(diagnostics(resolve(__dirname, 'types/providers.ts')).map(error =>
    ts.flattenDiagnosticMessageText(error.messageText, '\n'))).toEqual([]);
});

test('nested modules forward requirements and lexical lifetimes across levels', () => {
  expect(diagnostics(resolve(__dirname, 'types/nested-modules.ts')).map(error =>
    ts.flattenDiagnosticMessageText(error.messageText, '\n'))).toEqual([]);
});

test('module erasure fixtures keep exact exports, requirements, and carrier obligations', () => {
  expect(diagnostics(resolve(__dirname, 'types/module-erasure/consumer.ts')).map(error =>
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

const negativeDirectory = resolve(__dirname, 'types/negative');
const negativeFixtures = readdirSync(negativeDirectory)
  .filter((name) => name.endsWith('.ts'))
  .map((name) => resolve(negativeDirectory, name));
// One program for every independent rejection fixture; each test reads its own file's diagnostics.
const negativeDiagnostics = diagnosticsByFile(negativeFixtures);

test('singleton default child diagnostics start on replacementProviders', () => {
  const file = resolve(__dirname, 'types/negative/singleton-default.ts');
  const source = readFileSync(file, 'utf8');
  const errors = negativeDiagnostics.get(file)!;
  const matched = matchDiagnosticMarkers(source, file, errors.map(describeDiagnostic));
  expect(matched.unexpected).toEqual([]);
  expect(matched.missing).toEqual([]);
  const replacements = errors.filter(error =>
    ts.flattenDiagnosticMessageText(error.messageText, '\n')
      .includes('createChildContainer cannot replace singleton service'),
  );
  expect(replacements).toHaveLength(3);
  expect(replacements.map(error => source.slice(error.start!, error.start! + error.length!))).toEqual([
    '{ singleton: () => ({ value: 4 }) }',
    '{ [singletonToken.symbol]: () => ({ value: 2 }) }',
    'replacementProviders',
  ]);
});

test('singleton default union graph diagnostics remain', () => {
  const file = resolve(__dirname, 'types/negative/singleton-unions.ts');
  const source = readFileSync(file, 'utf8');
  const errors = negativeDiagnostics.get(file)!;
  const matched = matchDiagnosticMarkers(source, file, errors.map(describeDiagnostic));
  expect(matched.missing).toEqual([]);
  expect(matched.unexpected).toEqual([]);
  const childError = errors.find(error => ts.flattenDiagnosticMessageText(error.messageText, '\n')
    .includes('createChildContainer cannot replace singleton service: value'));
  expect(childError).toBeDefined();
  expect(source.slice(childError!.start!, childError!.start! + childError!.length!)).toBe('{ value: () => 3 }');
});

test('requirement-renaming wrong-shape details name the remapped relationship', () => {
  const path = resolve(negativeDirectory, 'requirement-renaming.ts');
  const wrongShape = negativeDiagnostics.get(path)!.filter(error =>
    ts.flattenDiagnosticMessageText(error.messageText, '\n').includes('provided service does not satisfy its consumer dependency'));
  expect(wrongShape).toHaveLength(1);
  const message = ts.flattenDiagnosticMessageText(wrongShape[0]!.messageText, '\n');
  expect(message).toContain('consumer: "service"');
  expect(message).toContain('dependency: "featureConfig"');
  expect(message).toContain('expected: Config');
  expect(message).toContain('provided: { value: string; }');
});

for (const path of negativeFixtures) {
  test(`type rejection: ${basename(path)}`, () => {
    const source = readFileSync(path, 'utf8');
    const expected = [...source.matchAll(/\/\/ diagnostic: (.+)/g)];
    expect(expected.length).toBeGreaterThan(0);
    const errors = negativeDiagnostics.get(path)!;
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.every((error) => error.file?.fileName === path)).toBe(true);
    const matched = matchDiagnosticMarkers(source, path, errors.map(describeDiagnostic));
    expect(matched.missing).toEqual([]); expect(matched.unexpected).toEqual([]);
  });
}

test('provider facade rejections remain property-located diagnostics', () => {
  const path = resolve(negativeDirectory, 'provider-facades.ts');
  const source = readFileSync(path, 'utf8');
  const markers = [...source.matchAll(/\/\/ diagnostic: (.+)/g)];
  const errors = negativeDiagnostics.get(path)!;
  expect(markers).toHaveLength(15);
  expect(errors).toHaveLength(15);
  const matched = matchDiagnosticMarkers(source, path, errors.map(describeDiagnostic));
  expect(matched.missing).toEqual([]);
  expect(matched.unexpected).toEqual([]);
  const anchors = errors.map(error => {
    const span = source.slice(error.start!, error.start! + error.length!);
    return span.startsWith('{') ? '{' : span;
  });
  expect(anchors).toEqual([
    'lifetime',
    'allowsScopedDependencies', 'allowsScopedDependencies',
    'allowsScopedDependencies', 'allowsScopedDependencies', 'extra',
    'callbackReceives', 'describeAcquisition',
    'transformReturnKind', 'transformReturnKind', 'transformReturnKind',
    'transformService', '{', 'registrationMetadata', 'dependent',
  ]);
});

test('provider facade lifetime option controls remain independently rejected', () => {
  const path = resolve(negativeDirectory, 'provider-facade-lifetime-controls.ts');
  const source = readFileSync(path, 'utf8');
  const markers = [...source.matchAll(/\/\/ diagnostic: (.+)/g)];
  const errors = negativeDiagnostics.get(path)!;
  expect(markers).toHaveLength(6);
  expect(errors).toHaveLength(6);
  const matched = matchDiagnosticMarkers(source, path, errors.map(describeDiagnostic));
  expect(matched.missing).toEqual([]);
  expect(matched.unexpected).toEqual([]);
  expect(errors.map(error => source.slice(error.start!, error.start! + error.length!))).toEqual([
    'unknownOptions',
    'undefinedOptions',
    'lifetime',
    'optionalScopedOptions',
    'indexedOptions',
    '[extraSymbol]',
  ]);
});

test('provider facade raw thenables remain rejected at their normalization boundary', () => {
  const path = resolve(negativeDirectory, 'provider-facade-thenables.ts');
  const source = readFileSync(path, 'utf8');
  const markers = [...source.matchAll(/\/\/ diagnostic: (.+)/g)];
  const errors = negativeDiagnostics.get(path)!;
  expect(markers).toHaveLength(14);
  expect(errors).toHaveLength(14);
  const matched = matchDiagnosticMarkers(source, path, errors.map(describeDiagnostic));
  expect(matched.missing).toEqual([]);
  expect(matched.unexpected).toEqual([]);
  expect(errors.slice(0, 12).map(error => source.slice(error.start!, error.start! + error.length!))).toEqual([
    'provider', 'provider', 'provider', 'provider', 'provider', 'provider',
    'provider', 'provider', 'exposedAcquisitionOptions', 'provider', 'provider',
    'fulfilledTransformOptions',
  ]);
  expect(errors.slice(12).every(error => source.slice(error.start!, error.start! + error.length!).includes('QueryBuilder'))).toBe(true);
});

test('provider replacement self admission preserves useful malformed-dependency diagnostics', () => {
  const path = resolve(negativeDirectory, 'provider-replacement-self-admission.ts');
  const source = readFileSync(path, 'utf8');
  const markers = [...source.matchAll(/\/\/ diagnostic: (.+)/g)];
  const errors = negativeDiagnostics.get(path)!;
  expect(markers).toHaveLength(6);
  expect(errors).toHaveLength(6);
  const matched = matchDiagnosticMarkers(source, path, errors.map(describeDiagnostic));
  expect(matched.missing).toEqual([]);
  expect(matched.unexpected).toEqual([]);
  expect(errors.slice(0, 3).every(error => ts.flattenDiagnosticMessageText(error.messageText, '\n').includes("not assignable to parameter of type 'never'"))).toBe(true);
  expect(errors.slice(3, 5).every(error => ts.flattenDiagnosticMessageText(error.messageText, '\n').includes('factory dependencies must be finite'))).toBe(true);
  expect(ts.flattenDiagnosticMessageText(errors[5]!.messageText, '\n')).toContain('No overload matches');
});
