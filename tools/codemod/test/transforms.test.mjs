// tools/codemod/test/transforms.test.mjs
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { defaultMapFile, runCodemod, transforms, validateRenameMap } from '../lib/codemod.mjs';
import { createLibrary } from '../lib/library.mjs';
import { compiler, fixtureProgram, fixturesProgram, fixturesRoot } from './helpers.mjs';

test('lifetime pins compose with provider, role, alias, and container transforms', () => {
  const result = runCodemod({
    typescript: compiler.ts,
    root: fixturesRoot,
    program: fixtureProgram('lifetime-pin'),
    only: ['lifetime-pin/input.ts'],
    pinLifetimes: true,
  });
  assert.equal(result.files.length, 1);
  const text = result.files[0].text;
  assert.match(text, /ContainerKit\.providerWithLifetime\(\{ provider: clock/);
  assert.match(text, /decorated: ContainerKit\.providerWithLifetime\(\{ provider: decorated/);
  assert.match(text, /withTokenService\(item, ContainerKit\.providerWithLifetime/);
  assert.match(text, /withCollectionContribution\(\{ collectionToken: items, provider: ContainerKit\.providerWithLifetime/);
  assert.match(text, /withReplacedService\(item, ContainerKit\.providerWithLifetime/);
  assert.match(text, /Library\.DiBag\.createBuilder\(\)[\s\S]*withServices\(\{ ns: ContainerKit\.providerWithLifetime/);
  assert.match(text, /unrelated\.createScope\(\)/);
  assert.deepEqual(result.manual.map(item => item.reason), [
    "register receives a nonliteral registration bag; add withLifetime('scoped:one-per-container') to each provider in that bag",
    "register contains a spread registration; add withLifetime('scoped:one-per-container') to each provider contributed by that spread",
  ]);
});

test('mixed token use remains manual while both provider arguments receive scoped pins', () => {
  const input = join(fixturesRoot, 'lifetime-pin/mixed.ts');
  const program = compiler.ts.createProgram([input], {
    strict: true, noEmit: true, skipLibCheck: true, types: [],
    target: compiler.ts.ScriptTarget.ES2022,
    module: compiler.ts.ModuleKind.NodeNext,
    moduleResolution: compiler.ts.ModuleResolutionKind.NodeNext,
  });
  const result = runCodemod({
    typescript: compiler.ts, root: fixturesRoot, program,
    only: ['lifetime-pin/mixed.ts'], pinLifetimes: true,
  });
  assert.equal(result.files.length, 1);
  assert.match(result.files[0].text, /DiBag\.createToken\(Symbol\('items'\)\)\.of<number>\(\)/);
  assert.match(result.files[0].text, /withCollectionContribution\(\{ collectionToken: items, provider: DiBag\.providerWithLifetime\(\{ provider: \(\) => 2/);
  assert.match(result.files[0].text, /withReplacedService\(items, DiBag\.providerWithLifetime\(\{ provider: \(\) => \[3\]/);
  assert.ok(result.manual.some(item => item.reason.includes('used as a collection and as a single service')));
});

test('whole-program policy analyzes files outside the output selection', () => {
  const result = runCodemod({
    typescript: compiler.ts,
    root: fixturesRoot,
    program: fixturesProgram(),
    only: ['whole-program-pin/source.ts'],
  });
  assert.match(result.files[0].text, /providerWithLifetime\(\{/);
});

test('explicit lifetime pin recognizes authenticated current phase-10 calls', () => {
  const projectRoot = resolve(import.meta.dirname, '../../..');
  const input = resolve(import.meta.dirname, 'current-lifetime-pin/input.ts');
  const program = compiler.ts.createProgram([input], {
    strict: true, noEmit: true, skipLibCheck: true, types: [],
    target: compiler.ts.ScriptTarget.ES2022,
    module: compiler.ts.ModuleKind.NodeNext,
    moduleResolution: compiler.ts.ModuleResolutionKind.NodeNext,
  });
  const source = program.getSourceFile(input);
  const importDeclaration = source.statements.find(compiler.ts.isImportDeclaration);
  const importSpecifier = importDeclaration.importClause.namedBindings.elements[0];
  const local = program.getTypeChecker().getSymbolAtLocation(importSpecifier.name);
  const exported = program.getTypeChecker().getAliasedSymbol(local);
  assert.ok(exported.declarations?.some(declaration =>
    resolve(declaration.getSourceFile().fileName).startsWith(resolve(projectRoot, 'src')),
  ), 'fixture must resolve Alias to this checkout, not a package or ambient declaration');
  const result = runCodemod({
    typescript: compiler.ts,
    root: projectRoot,
    program,
    libraryRoots: ['src'],
    only: ['tools/codemod/test/current-lifetime-pin/input.ts'],
    pinLifetimes: true,
  });
  assert.equal(result.files.length, 1);
  assert.ok(result.files[0].rewrites > 0, 'authenticated current calls must produce rewrites');
  assert.equal(result.files[0].text, readFileSync(resolve(import.meta.dirname, 'current-lifetime-pin/expected.ts'), 'utf8'));
});

test('lifetime pinning preserves custom synthetic bag and positional derivation shapes', () => {
  const scratch = mkdtempSync(join(tmpdir(), 'di-bag-lifetime-shapes-'));
  try {
    const library = join(scratch, 'library');
    mkdirSync(library);
    writeFileSync(join(library, 'index.ts'), `
export class Provider { withLifetime(_l: string): Provider { return this; } }
export class Container {
  createChildContainer(_options?: unknown, _providers?: unknown): Container { return this; }
  createIndependentContainer(_options?: unknown, _providers?: unknown): Container { return this; }
}
export class Builder {
  withTokenService(_optionsOrToken: unknown, _provider?: unknown): this { return this; }
  withCollectionContribution(_optionsOrToken: unknown, _provider?: unknown): this { return this; }
  withReplacedService(_optionsOrKey: unknown, _provider?: unknown): this { return this; }
  buildContainer(): Container { return new Container(); }
}
export class DiBag {
  static createProvider(_factory: unknown): Provider { return new Provider(); }
  static createBuilder(): Builder { return new Builder(); }
}
`);
    const input = join(scratch, 'input.ts');
    writeFileSync(input, `
import { DiBag } from './library/index.js';
const provider = () => 1;
const token = Symbol('token');
const options = { token, provider };
const container = DiBag.createBuilder()
  .withTokenService({ token, provider })
  .withTokenService(token, () => 2)
  .withCollectionContribution({ collectionToken: token, provider: () => 3 })
  .withCollectionContribution(token, () => 4)
  .withReplacedService({ serviceKey: token, provider: () => 5 })
  .withReplacedService(token, () => 6)
  .withTokenService({ ...options })
  .buildContainer();
container.createChildContainer({ replacedServiceKeys: ['a'], replacementProviders: { a: () => 7 } });
container.createChildContainer(['a'], { a: () => 8 });
container.createIndependentContainer({ replacedServiceKeys: ['a'], replacementProviders: { a: () => 9 } });
container.createIndependentContainer(['a'], { a: () => 10 });
`);
    const program = compiler.ts.createProgram([input], {
      strict: true, noEmit: true, skipLibCheck: true, types: [],
      target: compiler.ts.ScriptTarget.ES2022,
      module: compiler.ts.ModuleKind.NodeNext,
      moduleResolution: compiler.ts.ModuleResolutionKind.NodeNext,
    });
    const preferredMap = JSON.parse(readFileSync(defaultMapFile, 'utf8'));
    const preferredEntries = [
      { owner: 'Builder', from: 'register', to: 'withTokenService', arity: [2], arguments: { kind: 'bag', names: ['token', 'provider'] } },
      { owner: 'Builder', from: 'contribute', to: 'withCollectionContribution', arguments: { kind: 'bag', names: ['collectionToken', 'provider'] } },
      { owner: 'Builder', from: 'replace', to: 'withReplacedService', arguments: { kind: 'bag', names: ['serviceKey', 'provider'] } },
      { owner: 'Bag', from: 'createScope', to: 'createChildContainer', arity: [0, 1, 2, 3], transform: 'container-derivation', transformNames: { keys: 'replacedServiceKeys', providers: 'replacementProviders', sharing: 'sharedParentServiceKeys' } },
      { owner: 'Bag', from: 'fork', to: 'createIndependentContainer', arity: [0, 1, 2], transform: 'container-derivation', transformNames: { keys: 'replacedServiceKeys', providers: 'replacementProviders' } },
      { owner: 'DiBagApi', from: 'withLifetime', to: 'withLifetime' },
      { owner: 'DiBagApi', from: 'fromFactory', to: 'createProvider' },
    ];
    for (const preferred of preferredEntries) {
      preferredMap.methods = preferredMap.methods.filter(entry =>
        !(entry.owner === preferred.owner && entry.from === preferred.from));
      preferredMap.methods.push(preferred);
    }
    const result = runCodemod({
      typescript: compiler.ts, root: scratch, program,
      libraryRoots: ['library'], only: ['input.ts'], pinLifetimes: true, map: preferredMap,
    });
    assert.equal(result.files.length, 1);
    const pinned = result.files[0].text;
    assert.equal((pinned.match(/scoped:one-per-container/g) ?? []).length, 10);
    assert.match(pinned, /provider: .*scoped:one-per-container/);
    assert.match(pinned, /withTokenService\(token, .*scoped:one-per-container/);
    assert.match(pinned, /createChildContainer\(\['a'\], \{ a: .*scoped:one-per-container/);
    assert.match(pinned, /createIndependentContainer\(\['a'\], \{ a: .*scoped:one-per-container/);
    assert.deepEqual(result.manual.map(item => item.reason), [
      'withTokenService options contain a spread; preserve provider lifetimes in the spread source by hand',
    ]);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});

test('current provider facade preserves a nested explicit singleton lifetime', () => {
  const scratch = mkdtempSync(join(tmpdir(), 'di-bag-current-facade-'));
  try {
    const source = join(scratch, 'source.ts');
    writeFileSync(source, `
import { DiBag as Alias } from '${resolve(import.meta.dirname, '../../../src/index.js')}';
const explicit = Alias.providerWithLifetime({ provider: () => 1, lifetime: 'singleton:one-per-container-tree' });
const decorated = Alias.providerWithDisposal({ provider: explicit, disposeService: () => {} });
Alias.createBuilder().withServices({ decorated });
`);
    const program = compiler.ts.createProgram([source], {
      strict: true, noEmit: true, skipLibCheck: true, types: [],
      target: compiler.ts.ScriptTarget.ES2022,
      module: compiler.ts.ModuleKind.NodeNext,
      moduleResolution: compiler.ts.ModuleResolutionKind.NodeNext,
    });
    const result = runCodemod({
      typescript: compiler.ts, root: scratch, program,
      libraryRoots: [resolve(import.meta.dirname, '../../../src')],
      only: ['source.ts'], pinLifetimes: true,
    });
    assert.equal(result.files.length, 0);
    assert.deepEqual(result.manual, []);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});

test('mixed library and user receivers do not authorize lifetime pins', () => {
  const scratch = mkdtempSync(join(tmpdir(), 'di-bag-lifetime-coverage-'));
  try {
    const library = join(scratch, 'library');
    mkdirSync(library);
    writeFileSync(join(library, 'index.ts'), `
export class Provider {
  readonly providerKind = 'library-provider' as const;
  withLifetime(_lifetime: string): Provider { return this; }
}
export class Bag {
  readonly bagKind = 'library-bag' as const;
  createScope(): Bag { return this; }
}
export class Builder {
  readonly builderKind = 'library-builder' as const;
  register(_services: unknown): this { return this; }
  withServices(_services: unknown): this { return this; }
  build(): Bag { return new Bag(); }
}
export class DiBag {
  static createBuilder(): Builder { return new Builder(); }
}
`);
    const input = join(scratch, 'input.ts');
    writeFileSync(input, `
import { Bag, DiBag, Provider } from './library/index.js';
declare const chooseUser: boolean;
class UserBag {
  readonly bagKind = 'user-bag' as const;
  createScope(): UserBag { return this; }
}
class UserBuilder {
  readonly builderKind = 'user-builder' as const;
  withServices(_services: unknown): this { return this; }
}
class UserProvider {
  readonly providerKind = 'user-provider' as const;
  withLifetime(_lifetime: string): UserProvider { return this; }
}
const mixedBag = chooseUser ? new Bag() : new UserBag();
const mixedBuilder = chooseUser ? DiBag.createBuilder() : new UserBuilder();
const mixedProvider = chooseUser ? new Provider() : new UserProvider();
mixedBag.createScope();
mixedBuilder.withServices({ current: () => 1 });
new UserBuilder().withServices({ userOnly: () => 2 });
DiBag.createBuilder().register({
  plain: () => 3,
  current: mixedProvider.withLifetime('root'),
}).build();
`);
    const program = compiler.ts.createProgram([input], {
      strict: true, noEmit: true, skipLibCheck: true, types: [],
      target: compiler.ts.ScriptTarget.ES2022,
      module: compiler.ts.ModuleKind.NodeNext,
      moduleResolution: compiler.ts.ModuleResolutionKind.NodeNext,
    });
    const checker = program.getTypeChecker();
    const sourceFile = program.getSourceFile(input);
    assert.ok(sourceFile, 'coverage fixture source must belong to the program');
    const libraryApi = createLibrary({
      ts: compiler.ts, checker, root: scratch, libraryRoots: ['library'],
    });
    const mixedCoverage = new Map();
    function inspectCoverage(node) {
      if (compiler.ts.isCallExpression(node) && compiler.ts.isPropertyAccessExpression(node.expression)
          && compiler.ts.isIdentifier(node.expression.expression)) {
        const receiver = node.expression.expression.text;
        if (['mixedBag', 'mixedBuilder', 'mixedProvider'].includes(receiver)) {
          mixedCoverage.set(receiver, libraryApi.memberCoverage(libraryApi.symbolAt(node.expression.name)));
        }
      }
      compiler.ts.forEachChild(node, inspectCoverage);
    }
    inspectCoverage(sourceFile);
    for (const receiver of ['mixedBag', 'mixedBuilder', 'mixedProvider']) {
      const coverage = mixedCoverage.get(receiver);
      assert.ok(coverage?.members.length > 0, `${receiver} must retain its DI Bag declaration`);
      assert.equal(coverage.complete, false, `${receiver} must also retain its user declaration`);
    }
    const automatic = runCodemod({
      typescript: compiler.ts, root: scratch, program,
      libraryRoots: ['library'], only: ['input.ts'],
    });
    assert.doesNotMatch(automatic.files[0].text, /scoped:one-per-container/);
    assert.ok(automatic.manual.some(item => item.reason ===
      'createScope resolves to both DI Bag and non-library declarations; migrate this use by hand'));
    assert.ok(!automatic.manual.some(item => item.text.includes('userOnly')),
      'a pure user lookalike must not produce a DI Bag migration report');

    const explicit = runCodemod({
      typescript: compiler.ts, root: scratch, program,
      libraryRoots: ['library'], only: ['input.ts'], pinLifetimes: true,
    });
    assert.match(explicit.files[0].text, /plain: .*scoped:one-per-container/);
    assert.match(explicit.files[0].text, /current: mixedProvider\.withLifetime\('root'\)/);
    assert.ok(explicit.manual.some(item => item.reason ===
      'withServices resolves to both DI Bag and non-library declarations; preserve provider lifetimes by hand'));
    assert.ok(explicit.manual.some(item => item.reason ===
      "this provider's lifetime is not visible in the source file; preserve its 0.4 scoped behavior by hand"));
    assert.ok(!explicit.manual.some(item => item.text.includes('userOnly')),
      'explicit pinning must also ignore a pure user lookalike');
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});

test('nonliteral provider return kinds stay unchanged and report one manual item per constructor', () => {
  const result = runCodemod({
    typescript: compiler.ts, root: fixturesRoot, program: fixtureProgram('provider-nonliteral-return-kind'),
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
  const result = runCodemod({ typescript: compiler.ts, root: fixturesRoot, program: fixtureProgram('provider-facades'), map: renamed, only: ['provider-facades/input.ts'] });
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
  const edges = runCodemod({ typescript: compiler.ts, root: fixturesRoot, program: fixtureProgram('provider-facade-edges'), map: renamed, only: ['provider-facade-edges/input.ts'] });
  assert.match(edges.files[0].text, /DiBag\.mappedProviderWithRegistrationMetadata\(\{ mappedProvider: p, mappedRegistrationMetadata:/);
  assert.match(edges.files[0].text, /DiBag\.mappedProviderWithAcquisitionMetadata\(\{ mappedProvider: p, mappedDescribeAcquisition:/);
  assert.ok(edges.files[0].text.split('\n').includes("export const shorthandLifetime = DiBag.mappedProviderWithLifetime({ mappedProvider: p, mappedLifetime: 'singleton:one-per-container-tree', mappedAllowsScopedDependencies: allowScopedDependencies });"));
  assert.match(edges.files[0].text, /\/\* keep \*\//);
  assert.equal(compiler.ts.createSourceFile('edges.ts', edges.files[0].text, compiler.ts.ScriptTarget.Latest, true, compiler.ts.ScriptKind.TS).parseDiagnostics.length, 0);

  const edgeSource = fixtureProgram('provider-facade-edges').getSourceFiles().find(file => file.fileName.endsWith('/provider-facade-edges/input.ts'));
  assert.ok(edgeSource);
  const declarations = new Map();
  const visit = node => {
    if (compiler.ts.isVariableDeclaration(node) && compiler.ts.isIdentifier(node.name)) declarations.set(node.name.text, node);
    compiler.ts.forEachChild(node, visit);
  };
  visit(edgeSource);
  const unknownCall = declarations.get('manualUnknown')?.initializer;
  assert.ok(compiler.ts.isCallExpression(unknownCall));
  assert.ok(fixtureProgram('provider-facade-edges').getTypeChecker().getTypeAtLocation(unknownCall.arguments[0]).flags & compiler.ts.TypeFlags.Unknown);
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

  const main = runCodemod({ typescript: compiler.ts, root: fixturesRoot, program: fixtureProgram('provider-facades'), map, only: ['provider-facades/input.ts'] });
  const edges = runCodemod({ typescript: compiler.ts, root: fixturesRoot, program: fixtureProgram('provider-facade-edges'), map, only: ['provider-facade-edges/input.ts'] });
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
  const result = runCodemod({ typescript: compiler.ts, root: fixturesRoot, program: fixtureProgram('provider-sources'), only: ['provider-sources/input.ts'], map });
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
    typescript: compiler.ts, root: fixturesRoot, program: fixtureProgram('provider-token-classification'),
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
  const result = runCodemod({ typescript: compiler.ts, root: fixturesRoot, program: fixtureProgram('build-and-start'), only: ['build-and-start/input.ts'], map });
  assert.match(result.files[0].text, /builder\.buildContainer\(\)\.ensureServicesReady\(\['db'\]\);/);
  assert.doesNotMatch(result.files[0].text, /\.build\(\)/);
  assert.match(result.files[0].text, /\{ cancellation: shutdown, deadline: 5_000, "capacity limit": 1 \}/);
});

test('an undecidable custom transform leaves each whole call untouched and reports it', () => {
  const result = runCodemod({ typescript: compiler.ts, root: fixturesRoot, program: fixtureProgram('build-and-start'), only: ['build-and-start/input.ts'] });
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
    program: fixtureProgram('container-renames'),
    only: ['container-renames/input.ts'],
  };
  const alternateResult = runCodemod({ ...common, map: alternate });
  assert.match(alternateResult.files[0].text,
    /export const child3 = root\.spawnChild\(keys \/\* k \*\/, replacements \/\* p \*\/, \{ "parent-keys": \['b'\], \}\);/);
  const shippedResult = runCodemod({ ...common, map: shipped });
  assert.match(shippedResult.files[0].text,
    /export const child3 = root\.createChildContainer\(keys \/\* k \*\/, replacements \/\* p \*\/, \{ sharedParentServiceKeys: \['b'\], \}\);/);
});
