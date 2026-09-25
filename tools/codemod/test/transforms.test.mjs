// tools/codemod/test/transforms.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { defaultMapFile, runCodemod, transforms, validateRenameMap } from '../lib/codemod.mjs';
import { compiler, fixturesProgram, fixturesRoot } from './helpers.mjs';

test('nonliteral provider return kinds stay unchanged and report one manual item per constructor', () => {
  const result = runCodemod({
    typescript: compiler.ts, root: fixturesRoot, program: fixturesProgram(),
    only: ['provider-nonliteral-return-kind/input.ts'],
  });
  const input = readFileSync(new URL('./fixtures/provider-nonliteral-return-kind/input.ts', import.meta.url), 'utf8');
  assert.equal(result.files[0]?.text ?? input, input);
  assert.deepEqual(result.manual.map(({ line, reason }) => ({ line, reason })), [
    { line: 4, reason: 'fromFactory acquisitionMode is not a supported string literal; rewrite factoryReturnKind by hand' },
    { line: 5, reason: 'fromFunction acquisitionMode is not a supported string literal; rewrite factoryReturnKind by hand' },
    { line: 6, reason: 'fromClass acquisitionMode is not a supported string literal; rewrite factoryReturnKind by hand' },
    { line: 7, reason: 'fromPlugin acquisitionMode is not a supported string literal; rewrite factoryReturnKind by hand' },
  ]);
  assert.doesNotMatch(result.files[0]?.text ?? input, /factoryReturnKind: 'null'/);
});

test('every transform the shipped map names exists in the registry', () => {
  const shipped = JSON.parse(readFileSync(defaultMapFile, 'utf8'));
  assert.deepEqual(validateRenameMap(shipped, Object.keys(transforms)), []);
  assert.deepEqual(Object.keys(transforms), ['build-and-start', 'collection-read', 'collection-reference', 'collection-token', 'container-derivation', 'provider-facades', 'provider-sources']);
});

test('provider facades use original types, mapped roles, and transformed children', () => {
  const shipped = JSON.parse(readFileSync(defaultMapFile, 'utf8'));
  const renamed = {
    ...shipped,
    methods: shipped.methods.map(entry => entry.transform === 'provider-facades' ? {
      ...entry,
      transformNames: Object.fromEntries(Object.entries(entry.transformNames).map(([role, value]) => [role, `mapped${value[0].toUpperCase()}${value.slice(1)}`])),
    } : entry).map(entry => entry.owner === 'DiBagApi' && entry.from === 'fromFactory' ? { ...entry, to: 'makeProvider' } : entry),
  };
  const result = runCodemod({ typescript: compiler.ts, root: fixturesRoot, program: fixturesProgram(), map: renamed, only: ['provider-facades/input.ts'] });
  const output = result.files[0].text;
  assert.match(output, /derived\.mappedProviderWithDisposal\(\{ mappedProvider: f, mappedDisposeService:/);
  assert.match(output, /DiBag\.mappedProviderWithLifetime\(\{ mappedProvider: DiBag\.mappedProviderWithDisposal\(\{ mappedProvider: f, mappedDisposeService:/);
  assert.match(output, /mappedTransformReturnKind/);
  assert.match(output, /export type OldOwned = Provider<typeof f>;/);
  assert.match(output, /export type OldDependentOwned = Provider<\(\{ value \}: \{ value: number \}\) => string>;/);
  assert.equal(compiler.ts.createSourceFile('output.ts', output, compiler.ts.ScriptTarget.Latest, true, compiler.ts.ScriptKind.TS).parseDiagnostics.length, 0);
  assert.deepEqual(result.manual.map(({ file, line, reason }) => ({ file, line, reason })), [
    { file: 'provider-facades/input.ts', line: 7, reason: 'combined static and dynamic metadata can change evaluation order when split; rewrite the two provider bags by hand' },
    { file: 'provider-facades/input.ts', line: 11, reason: 'the transformService options are not a supported object literal; rewrite the provider bag by hand' },
    { file: 'provider-facades/input.ts', line: 13, reason: 'the decorated value is any, unknown, invalid, or a factory/provider union; wrap a factory with createProvider or supply a provider by hand' },
  ]);
  assert.ok(result.manual.every(item => Number.isInteger(item.column) && typeof item.text === 'string'));
  const edges = runCodemod({ typescript: compiler.ts, root: fixturesRoot, program: fixturesProgram(), map: renamed, only: ['provider-facade-edges/input.ts'] });
  assert.match(edges.files[0].text, /DiBag\.mappedProviderWithRegistrationMetadata\(\{ mappedProvider: p, mappedRegistrationMetadata:/);
  assert.match(edges.files[0].text, /DiBag\.mappedProviderWithAcquisitionMetadata\(\{ mappedProvider: p, mappedDescribeAcquisition:/);
  assert.ok(edges.files[0].text.split('\n').includes("export const shorthandLifetime = DiBag.mappedProviderWithLifetime({ mappedProvider: p, mappedLifetime: 'singleton:one-per-container-tree', mappedAllowsScopedDependencies: allowScopedDependencies });"));
  assert.match(edges.files[0].text, /\/\* keep \*\//);
  assert.equal(compiler.ts.createSourceFile('edges.ts', edges.files[0].text, compiler.ts.ScriptTarget.Latest, true, compiler.ts.ScriptKind.TS).parseDiagnostics.length, 0);

  const edgeSource = fixturesProgram().getSourceFiles().find(file => file.fileName.endsWith('/provider-facade-edges/input.ts'));
  assert.ok(edgeSource);
  const declarations = new Map();
  const visit = node => {
    if (compiler.ts.isVariableDeclaration(node) && compiler.ts.isIdentifier(node.name)) declarations.set(node.name.text, node);
    compiler.ts.forEachChild(node, visit);
  };
  visit(edgeSource);
  const unknownCall = declarations.get('manualUnknown')?.initializer;
  assert.ok(compiler.ts.isCallExpression(unknownCall));
  assert.ok(fixturesProgram().getTypeChecker().getTypeAtLocation(unknownCall.arguments[0]).flags & compiler.ts.TypeFlags.Unknown);
  const duplicateCall = declarations.get('duplicate')?.initializer;
  assert.ok(compiler.ts.isCallExpression(duplicateCall));
  const duplicateOptions = duplicateCall.arguments[1];
  assert.ok(compiler.ts.isObjectLiteralExpression(duplicateOptions));
  assert.equal(duplicateOptions.properties.filter(property => compiler.ts.isPropertyAssignment(property)
    && !compiler.ts.isComputedPropertyName(property.name) && property.name.text === 'mode').length, 2);
});

test('provider facade role names remain valid property and member names', () => {
  const shipped = JSON.parse(readFileSync(defaultMapFile, 'utf8'));
  const transformNames = {
    withDisposal: { method: 'provider-with-disposal', provider: 'provider-source', disposeService: 'dispose-service' },
    withLifetime: { method: 'provider-with-lifetime', provider: 'provider-source', lifetime: 'lifetime-policy', allowsScopedDependencies: 'allows-scoped-dependencies' },
    withMetadata: {
      registrationFacade: 'provider-with-registration"metadata',
      acquisitionFacade: 'provider-with-acquisition"metadata',
      provider: 'provider-source',
      registrationMetadata: 'registration-metadata',
      describeAcquisition: 'describe"acquisition',
      callbackReceives: 'callback-receives',
    },
    transformService: {
      method: 'provider-with-transformed\\service',
      provider: 'provider-source',
      transformService: 'transform-service',
      callbackReceives: 'callback-receives',
      transformReturnKind: 'transform\\return-kind',
    },
  };
  const map = {
    ...shipped,
    methods: shipped.methods.map(entry => entry.transform === 'provider-facades'
      ? { ...entry, transformNames: transformNames[entry.from] }
      : entry),
  };
  assert.deepEqual(validateRenameMap(map, Object.keys(transforms)), []);

  const main = runCodemod({ typescript: compiler.ts, root: fixturesRoot, program: fixturesProgram(), map, only: ['provider-facades/input.ts'] });
  const edges = runCodemod({ typescript: compiler.ts, root: fixturesRoot, program: fixturesProgram(), map, only: ['provider-facade-edges/input.ts'] });
  assert.match(main.files[0].text, /\["provider-with-transformed\\\\service"\]\(\{ "provider-source": p, "transform-service": value => value, "callback-receives": 'exposed-service', "transform\\\\return-kind": 'native-promise' \}\)/);
  assert.match(edges.files[0].text, /\["provider-with-acquisition\\\"metadata"\]\(\{ "provider-source": p, "describe\\\"acquisition": describe, "callback-receives": 'exposed-service' \}\)/);
  assert.match(edges.files[0].text, /\["provider-with-lifetime"\]\(\{ "provider-source": p, "lifetime-policy": 'singleton:one-per-container-tree', "allows-scoped-dependencies": allowScopedDependencies \}\)/);

  const rows = [...main.files[0].text.split('\n'), ...edges.files[0].text.split('\n')]
    .filter(row => /^export const (transformed|dynamicOnly|shorthandLifetime) = /.test(row));
  const sourceText = `
interface Facade {
  ["provider-with-lifetime"](options: Record<string, unknown>): unknown;
  ["provider-with-transformed\\\\service"](options: {
    "provider-source": unknown;
    "transform-service": (value: unknown) => unknown;
    "callback-receives": string;
    "transform\\\\return-kind": string;
  }): unknown;
  ["provider-with-acquisition\\\"metadata"](options: Record<string, unknown>): unknown;
}
declare const DiBag: Facade;
declare const p: unknown;
declare const describe: (value: number) => { value: number };
declare const allowScopedDependencies: boolean;
${rows.join('\n')}
`;
  const ts = compiler.ts;
  const fileName = '/provider-facade-role-output.ts';
  const options = { noEmit: true, skipLibCheck: true, types: [], target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext };
  const host = ts.createCompilerHost(options);
  const getSourceFile = host.getSourceFile.bind(host);
  host.fileExists = name => name === fileName || ts.sys.fileExists(name);
  host.readFile = name => name === fileName ? sourceText : ts.sys.readFile(name);
  host.getSourceFile = (name, languageVersion, onError, shouldCreateNewSourceFile) => name === fileName
    ? ts.createSourceFile(name, sourceText, languageVersion, true, ts.ScriptKind.TS)
    : getSourceFile(name, languageVersion, onError, shouldCreateNewSourceFile);
  const diagnostics = ts.getPreEmitDiagnostics(ts.createProgram([fileName], options, host));
  assert.deepEqual(diagnostics.map(diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')), []);
});

test('provider source transforms ask their method entries for emitted field names', () => {
  const shipped = JSON.parse(readFileSync(defaultMapFile, 'utf8'));
  const map = {
    ...shipped,
    methods: shipped.methods.map(entry => entry.owner === 'DiBagApi' && entry.from === 'fromFunction'
      ? { ...entry, to: 'adapt', transformNames: { dependencies: 'needs', callable: 'make', returnKind: 'policy', receivesContext: 'takesContext' } }
      : entry),
  };
  const result = runCodemod({ typescript: compiler.ts, root: fixturesRoot, program: fixturesProgram(), only: ['provider-sources/input.ts'], map });
  assert.match(result.files[0].text, /DiBag\.adapt\(\{ needs: \[clock\], make: value => Promise\.resolve\(value\.now\(\)\), policy: 'native-promise' \}\)/);
});

test('collection token constructor and role names come from the map even when kind stays manual', () => {
  const shipped = JSON.parse(readFileSync(defaultMapFile, 'utf8'));
  const map = {
    ...shipped,
    methods: shipped.methods.map(entry => entry.owner === 'DiBagApi' && entry.from === 'token'
      ? { ...entry, to: 'makeToken' }
      : entry.owner === 'token()' && entry.from === 'of'
        ? { ...entry, to: 'many', transformNames: { single: 'one', collection: 'many' } }
        : entry),
  };
  const result = runCodemod({
    typescript: compiler.ts, root: fixturesRoot, program: fixturesProgram(),
    only: ['provider-token-classification/input.ts'], map,
  });
  const text = result.files[0].text;
  assert.match(text, /DiBag\.makeToken\(singleSymbol\)\.one<number>\(\)/);
  assert.match(text, /DiBag\.makeToken\(collectionSymbol\)\.many<number>\(\)/);
  assert.match(text, /DiBag\.makeToken\(mixedSymbol\)\.of<number>\(\)/);
  assert.match(text, /DiBag\.makeToken\(inlineSymbol\)\.of<number>\(\)/);
  assert.deepEqual(result.manual.map(({ line, reason }) => ({ line, reason })), [
    { line: 5, reason: 'mixed is used as a collection and as a single service (provider-token-classification/input.ts:11); create a second token with many and keep the single token with one' },
    { line: 13, reason: 'token creation is not bound to a traceable program variable; choose one or many by hand' },
  ]);
});

test('a map that names an unknown transform is refused before any file is read', () => {
  const map = { version: 1, methods: [{ owner: 'Builder', from: 'build', to: 'buildContainer', transform: 'absent' }] };
  assert.throws(() => runCodemod({ typescript: compiler.ts, root: fixturesRoot, program: fixturesProgram(), map }), /unknown transform absent/);
});

test('a transform asks the map for the names it emits', () => {
  const shipped = JSON.parse(readFileSync(defaultMapFile, 'utf8'));
  const map = {
    ...shipped,
    methods: [
      ...shipped.methods.map(entry => entry.owner === 'Builder' && entry.from === 'buildAndStart'
        ? { ...entry, transformNames: { concurrency: 'capacity limit' } }
        : entry),
      { owner: 'Builder', from: 'build', to: 'buildContainer' },
    ],
    properties: shipped.properties.map(entry => entry.owner !== 'StartupOptions' ? entry
      : entry.from === 'signal' ? { ...entry, to: 'cancellation' }
      : entry.from === 'timeoutMs' ? { ...entry, to: 'deadline' }
      : entry),
  };
  const result = runCodemod({ typescript: compiler.ts, root: fixturesRoot, program: fixturesProgram(), only: ['build-and-start/input.ts'], map });
  assert.match(result.files[0].text, /builder\.buildContainer\(\)\.ensureServicesReady\(\['db'\]\);/);
  assert.doesNotMatch(result.files[0].text, /\.build\(\)/);
  assert.match(result.files[0].text, /\{ cancellation: shutdown, deadline: 5_000, "capacity limit": 1 \}/);
});

test('an undecidable custom transform leaves each whole call untouched and reports it', () => {
  const result = runCodemod({ typescript: compiler.ts, root: fixturesRoot, program: fixturesProgram(), only: ['build-and-start/input.ts'] });
  const text = result.files[0].text;
  assert.match(text, /builder\.buildAndStart\(\['db'\], \{ signal: shutdown as StartupOptions\['signal'\], timeoutMs: 3_000, startupOrder: order \}\)/);
  assert.match(text, /builder\.buildAndStart\(\['db'\], \{ timeoutMs: 3_000, \.\.\.spreadOptions \}\)/);
  assert.match(text, /builder\.buildAndStart\(\.\.\.\(\[\['db'\], \{ startupOrder: 'parallel' \}\] as \[readonly \['db'\], StartupOptions\]\)\)/);
  assert.ok(result.manual.some(item => item.reason.startsWith('startupOrder is not a literal')));
  assert.ok(result.manual.some(item => item.reason.startsWith('options are spread here')));
  assert.ok(result.manual.some(item => item.reason.startsWith('buildAndStart is called with a spread argument')));
});

test('container derivation uses mapped role names and preserves three-argument trivia', () => {
  const shipped = JSON.parse(readFileSync(defaultMapFile, 'utf8'));
  const alternate = {
    ...shipped,
    methods: shipped.methods.map(entry => entry.owner === 'Bag' && entry.from === 'createScope'
      ? {
          ...entry,
          to: 'spawnChild',
          transformNames: { keys: 'chosenKeys', providers: 'providerMap', sharing: 'parent-keys' },
        }
      : entry),
  };
  const common = {
    typescript: compiler.ts,
    root: fixturesRoot,
    program: fixturesProgram(),
    only: ['container-renames/input.ts'],
  };
  const alternateResult = runCodemod({ ...common, map: alternate });
  assert.match(alternateResult.files[0].text,
    /export const child3 = root\.spawnChild\(keys \/\* k \*\/, replacements \/\* p \*\/, \{ "parent-keys": \['b'\], \}\);/);
  const shippedResult = runCodemod({ ...common, map: shipped });
  assert.match(shippedResult.files[0].text,
    /export const child3 = root\.createChildContainer\(keys \/\* k \*\/, replacements \/\* p \*\/, \{ sharedParentServiceKeys: \['b'\], \}\);/);
});
