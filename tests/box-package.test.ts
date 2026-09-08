import { afterAll, beforeAll, expect, test } from 'bun:test';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, existsSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import ts from 'typescript';
import { boxContractFixtures, boxContractSource } from './box-contract-fixtures';
import { matchDiagnosticMarkers } from './diagnostic-markers';
import { describeDiagnostic } from './compiler';
import { finalAdversarialExpectedResult, finalAdversarialPackageRuntimeSource } from './final-adversarial-runtime-fixture';
import { supervise } from '../scripts/native-process';
import { nativeLimits } from '../scripts/native-compiler';

const root = resolve(__dirname, '..');
const fixtures = resolve(__dirname, 'fixtures/box-packages');
const packed = mkdtempSync(join(tmpdir(), 'di-bag-box-pack-'));
const packageTree = mkdtempSync(join(tmpdir(), 'di-bag-box-package-'));
const consumer = mkdtempSync(join(tmpdir(), 'di-bag-box-consumer-'));
const coreConsumer = mkdtempSync(join(tmpdir(), 'di-bag-core-consumer-'));
let archive: string;

afterAll(() => {
  for (const directory of [packed, consumer, coreConsumer, packageTree]) rmSync(directory, { recursive: true, force: true });
});

async function execute(command: string[], cwd = root) {
  const result = await supervise(command[0]!, command.slice(1), cwd,
    { ...nativeLimits, timeoutMilliseconds: 120_000 });
  return { code: result.status, stdout: result.stdout, stderr: result.stderr,
    signal: result.signal, terminationReason: result.terminationReason };
}

async function run(command: string[], cwd = root) {
  const { code, stdout, stderr, signal, terminationReason } = await execute(command, cwd);
  expect({ code, stderr: code === 0 ? '' : stderr, signal, terminationReason })
    .toEqual({ code: 0, stderr: '', signal: null, terminationReason: undefined });
  return stdout;
}

function traceInstalledRoot(entry: string) {
  const pending = [entry];
  const files = new Set<string>();
  const bareImports = new Set<string>();
  const unresolvedRelativeImports = new Set<string>();
  while (pending.length > 0) {
    const file = pending.pop()!;
    if (files.has(file)) continue;
    files.add(file);
    const source = readFileSync(file, 'utf8');
    const specifiers: string[] = [];
    const syntax = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const visit = (node: ts.Node): void => {
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
        && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) specifiers.push(node.moduleSpecifier.text);
      if (ts.isCallExpression(node) && node.arguments.length > 0 && ts.isStringLiteral(node.arguments[0]!)) {
        if (node.expression.kind === ts.SyntaxKind.ImportKeyword
          || (ts.isIdentifier(node.expression) && node.expression.text === 'require')) specifiers.push(node.arguments[0]!.text);
      }
      ts.forEachChild(node, visit);
    };
    visit(syntax);
    for (const specifier of specifiers) {
      if (!specifier.startsWith('.')) { bareImports.add(specifier); continue; }
      const base = resolve(dirname(file), specifier);
      const target = [base, `${base}.js`, join(base, 'index.js')].find(existsSync);
      if (target === undefined) unresolvedRelativeImports.add(`${file}:${specifier}`);
      else pending.push(target);
    }
  }
  return { files: [...files].sort(), bareImports: [...bareImports].sort(),
    unresolvedRelativeImports: [...unresolvedRelativeImports].sort() };
}

beforeAll(async () => {
  for (const file of ['src', 'package.json', 'tsconfig.json', 'tsconfig.build.json']) cpSync(join(root, file), join(packageTree, file), { recursive: true });
  await run(['node', join(root, 'node_modules/typescript/bin/tsc6'), '-p', 'tsconfig.build.json'], packageTree);
  const result = JSON.parse(await run(['npm', 'pack', '--ignore-scripts', '--json', '--pack-destination', packed], packageTree));
  archive = join(packed, result[0].filename);
  const files: string[] = result[0].files.map((entry: { path: string }) => entry.path);
  expect(files.every(path => ['package.json', 'README.md', 'LICENSE'].includes(path) || path.startsWith('dist/'))).toBe(true);
  expect(files.some(path => /(^|\/)(?:fixtures?|tests?|src|node_modules)(?:\/|$)/i.test(path)
    || path.endsWith('.tgz') || /(?:credentials?|secrets?|(?:^|\/)\.env(?:\.|$)|(?:^|\/)\.npmrc$)/i.test(path)
    || /^dist\/(?:adapters?|internal)\//.test(path))).toBe(false);
  for (const name of ['sas-box', 'val-box']) {
    expect(files.filter(path => path.includes(name))).toEqual([`dist/${name}.d.ts`, `dist/${name}.js`]);
  }
  for (const name of ['index', 'node', 'sas-box', 'val-box']) {
    expect(files).toContain(`dist/${name}.d.ts`);
    expect(files).toContain(`dist/${name}.js`);
  }
  await run(['npm', 'install', '--offline', '--ignore-scripts', '--no-audit', '--no-fund', '--no-package-lock', archive,
    join(fixtures, 'sas-box-0.1.0.tgz'), join(fixtures, 'val-box-0.1.0.tgz')], consumer);
  await run(['npm', 'install', '--offline', '--ignore-scripts', '--no-audit', '--no-fund', '--no-package-lock', archive], coreConsumer);
  writeFileSync(join(consumer, 'replacement-module-feature.ts'),
    readFileSync(resolve(__dirname, 'types/modules/feature.ts'), 'utf8')
      .replace(/from '(?:\.\.\/)+src'/g, "from 'di-bag'"));
});

test('installed replacement module support compiles through the public archive', () => {
  const path = join(consumer, 'replacement-module-feature.ts');
  const options: ts.CompilerOptions = { strict: true, noEmit: true, noUncheckedIndexedAccess: true,
    exactOptionalPropertyTypes: true, types: [], target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext };
  expect(ts.getPreEmitDiagnostics(ts.createProgram([path], options)).map(error =>
    ts.flattenDiagnosticMessageText(error.messageText, '\n'))).toEqual([]);
});

test('real fixtures retain the verified archive hashes', () => {
  for (const [name, expected] of [
    ['sas-box', '1df071c09f98ae59141986622f174a1180d28835acd4aef2d7aac5339e5e5debfeb4d9c5de9f32d87181f92183c3a18af1ac4b84a4baec43971b3aec62d329db'],
    ['val-box', '3e4a4b9fbdb39523eab607f2f758e65fa86e919251655ca31e4905c2c4e3c12c3f214a54f64a4929ce01abac7d2ee92df105e51e614c4831d356c8c669cc7ed8'],
  ]) expect(createHash('sha512').update(new Uint8Array(readFileSync(join(fixtures, `${name}-0.1.0.tgz`)))).digest('hex')).toBe(expected!);
});

test('embedded CJS and ESM adversarial consumers use every public subpath without repository imports', () => {
  for (const mode of ['commonjs', 'module'] as const) {
    const source = finalAdversarialPackageRuntimeSource(mode);
    for (const specifier of ['di-bag', 'di-bag/node', 'di-bag/sas-box', 'di-bag/val-box', 'sas-box', 'val-box']) {
      expect(source).toContain(mode === 'commonjs' ? `require('${specifier}')` : `from '${specifier}'`);
    }
    expect(source).not.toMatch(/(?:\.related-repos|(?:^|[/'])src[/']|tests?[/'])/m);
  }
});

test('installed import graph tracing includes ESM side effects, exports, dynamic imports, and CJS requires', () => {
  const graph = join(coreConsumer, 'trace-fixture');
  mkdirSync(graph);
  cpSync(join(coreConsumer, 'node_modules/di-bag/package.json'), join(graph, 'package.json'), { recursive: true });
  for (const name of ['side', 'exported', 'dynamic', 'required']) writeFileSync(join(graph, `${name}.js`), '');
  writeFileSync(join(graph, 'entry.js'), `
    import './side.js';
    export * from './exported.js';
    void import('./dynamic.js');
    require('./required.js');
    import 'node:fs';
  `);
  const traced = traceInstalledRoot(join(graph, 'entry.js'));
  expect(traced.bareImports).toEqual(['node:fs']);
  expect(traced.unresolvedRelativeImports).toEqual([]);
  expect(traced.files.map(file => file.slice(graph.length + 1))).toEqual([
    'dynamic.js', 'entry.js', 'exported.js', 'required.js', 'side.js',
  ]);
});

test('packed core root runs in CJS and ESM under Node and Bun without boxes or Node runtime imports', async () => {
  expect(existsSync(join(coreConsumer, 'node_modules/sas-box'))).toBe(false);
  expect(existsSync(join(coreConsumer, 'node_modules/val-box'))).toBe(false);
  const packageRoot = join(coreConsumer, 'node_modules/di-bag');
  const distRoot = join(packageRoot, 'dist');
  const traced = traceInstalledRoot(join(distRoot, 'index.js'));
  expect(traced.unresolvedRelativeImports).toEqual([]);
  expect(traced.files.every(file => file.startsWith(`${distRoot}/`))).toBe(true);
  expect(traced.bareImports.filter(specifier => specifier.startsWith('node:'))).toEqual([]);
  expect(traced.files.some(file => /[/\\](?:node|sas-box|val-box)\.js$/.test(file))).toBe(false);
  const failures: unknown[] = [];
  for (const mode of ['commonjs', 'module'] as const) {
    const runtime = join(coreConsumer, `core-only.${mode === 'commonjs' ? 'cjs' : 'mjs'}`);
    const load = mode === 'commonjs'
      ? `const Module = require('node:module'); const originalLoad = Module._load;
        Module._load = function(name, ...args) { if (name.startsWith('node:')) throw new Error('core imported Node'); return originalLoad.call(this, name, ...args); };
        const { DiBag } = require('di-bag');
        if (Object.keys(require.cache).some(path => /dist[/\\\\](sas-box|val-box)\\.js$/.test(path))) throw new Error('adapter loaded');`
      : `import Module, { createRequire } from 'node:module'; const originalLoad = Module._load;
        Module._load = function(name, ...args) { if (name.startsWith('node:')) throw new Error('core imported Node'); return originalLoad.call(this, name, ...args); };
        const { DiBag } = await import('di-bag');
        const localRequire = createRequire(import.meta.url);
        if (Object.keys(localRequire.cache).some(path => /dist[/\\\\](sas-box|val-box)\\.js$/.test(path))) throw new Error('adapter loaded');`;
    writeFileSync(runtime, `${load}
      (async () => {
      const bag = DiBag.begin().add({ answer: DiBag.factory(() => 42, { acquisition: 'raw' }) }).end();
      console.log(bag.resolve('answer')); await bag.close();
      })().catch(error => { console.error(error); process.exitCode = 1; });`);
    for (const executable of ['node', process.execPath]) {
      const executed = await execute([executable, runtime], coreConsumer);
      if (executed.code !== 0 || executed.stderr !== '' || executed.stdout.trim() !== '42') failures.push({ mode, executable, ...executed });
    }
  }
  expect(failures).toEqual([]);
});

for (const mode of ['commonjs', 'module'] as const) {
  test(`installed real box ${mode} archive runs the full adversarial oracle in Node and Bun`, async () => {
    const runtime = join(consumer, `final-adversarial.${mode === 'commonjs' ? 'cjs' : 'mjs'}`);
    writeFileSync(runtime, finalAdversarialPackageRuntimeSource(mode));
    const failures: unknown[] = [];
    for (const executable of ['node', process.execPath]) {
      const executed = await execute([executable, runtime], consumer);
      let result: unknown;
      try { result = JSON.parse(executed.stdout.trim()); } catch { result = undefined; }
      if (executed.code !== 0 || executed.stderr !== ''
        || JSON.stringify(result) !== JSON.stringify(finalAdversarialExpectedResult)) {
        failures.push({ executable, ...executed, result });
      }
    }
    expect(failures).toEqual([]);
  });

  test(`installed real boxes compose in Node ${mode} and share cross-loader descriptors`, async () => {
    const load = mode === 'commonjs'
      ? `const { DiBag } = require('di-bag/node'); const { fromSasBox } = require('di-bag/sas-box'); const { fromValBox } = require('di-bag/val-box'); const { SasBox } = require('sas-box'); const { ValBox } = require('val-box');`
      : `import { DiBag } from 'di-bag/node'; import { fromSasBox } from 'di-bag/sas-box'; import { fromValBox } from 'di-bag/val-box'; import { SasBox } from 'sas-box'; import { ValBox } from 'val-box';`;
    const output = await run(['node', `--input-type=${mode}`, '--eval', `${load}
      (async () => {
        const payload = { answer: 42 }; const rawPromise = Promise.resolve(43); const events = [];
        const raw = new ValBox.WithValue.WithMetadata(payload, { owner: 'real' }, 'db');
        const promiseBox = new ValBox.WithValue.WithMetadata(rawPromise, { owner: 'promise' }, 'promise-db');
        const esm = await import('di-bag/sas-box');
        const cjs = (await import('node:module')).createRequire(process.cwd() + '/consumer.cjs');
        const tokenKey = Symbol('real-box'); const selected = cjs('di-bag').DiBag.token(tokenKey).of();
        const promiseKey = Symbol('promise-box'); const selectedPromise = cjs('di-bag').DiBag.token(promiseKey).of();
        const tokenProvider = DiBag.withMetadata(fromValBox(esm.fromSasBox(
          DiBag.fromTokens([selected], value => SasBox.fromValue(value)), { mode: 'sync' })), { boundary: 'real-box-token' });
        const tokenPromise = fromValBox(esm.fromSasBox(
          DiBag.fromTokens([selectedPromise], value => SasBox.fromValue(value)), { mode: 'sync' }));
        const tokenFeature = DiBag.module()
          .bind(selected, DiBag.withDisposal(() => raw, value => { events.push(value === raw ? 'raw-box' : 'wrong-box'); }))
          .bind(selectedPromise, DiBag.withDisposal(() => promiseBox, value => { events.push(value === promiseBox ? 'promise-box' : 'wrong-promise-box'); }))
          .add({ tokenProvider, tokenPromise }).exports(['tokenProvider', 'tokenPromise']);
        const tokenRuntime = cjs('di-bag/node').DiBag.begin().install(tokenFeature).end();
        const tokenIdentity = tokenRuntime.resolve('tokenProvider') === payload;
        const tokenPromiseIdentity = tokenRuntime.resolve('tokenPromise') === rawPromise;
        const tokenInspection = tokenRuntime.inspect('tokenProvider');
        await tokenRuntime.close();
        const provider = fromValBox(fromSasBox(() => SasBox.fromValue(raw), { mode: 'sync' }));
        const bag = cjs('di-bag/node').DiBag.begin().add({
          service: DiBag.withDisposal(provider, value => { events.push(value === payload ? 'payload' : 'wrong'); }),
          cross: esm.fromSasBox(DiBag.withMetadata(() => SasBox.fromValue(7), { source: 'cross' }), { mode: 'sync-first' }),
          async: fromSasBox(() => SasBox.fromAsync(async () => 9), { mode: 'sync-first' }),
        }).end();
        const value = bag.resolve('service'); const cross = await bag.resolve('cross'); const asyncValue = await bag.resolve('async');
        const frames = bag.inspect('service').acquisitions[0].metadata;
        raw.setMetadata({ owner: 'changed' });
        await bag.close();
        console.log(JSON.stringify({ identity: value === payload, cross, asyncValue, frames, events, tokenIdentity,
          tokenPromiseIdentity, tokenMetadata: tokenInspection.metadata, tokenFrames: tokenInspection.acquisitions[0].metadata }));
      })().catch(error => { console.error(error); process.exitCode = 1; });`], consumer);
    expect(JSON.parse(output)).toEqual({ identity: true, cross: 7, asyncValue: 9,
      frames: [{ present: true, value: { kind: 'val-box', metadata: { present: true, value: { owner: 'real' } }, alias: 'db' } }],
      events: ['promise-box', 'raw-box', 'payload'], tokenIdentity: true, tokenPromiseIdentity: true,
      tokenMetadata: { boundary: 'real-box-token' },
      tokenFrames: [{ present: true, value: { kind: 'val-box', metadata: { present: true, value: { owner: 'real' } }, alias: 'db' } }] });
  });

  test(`installed ${mode} modern inline declarations survive emission and unchanged consumption`, () => {
    const extension = mode === 'commonjs' ? 'cts' : 'mts';
    const runtimeExtension = mode === 'commonjs' ? 'cjs' : 'mjs';
    const featurePath = join(consumer, `modern-feature.${extension}`);
    const consumerPath = join(consumer, `modern-consumer.${extension}`);
    const assertions = `type Assert<T extends true> = T; type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;`;
    const source = readFileSync(resolve(__dirname, 'types/modern-inline.ts'), 'utf8')
      .replace(/from '(?:\.\.\/)+src\/(provider|tokens|token-types|module-types)'/g, "from './node_modules/di-bag/dist/$1.js'")
      .replace("import('../../src')", "import('di-bag')")
      .replace(/from '(?:\.\.\/)+src(\/[^']+)?'/g, (_match, subpath: string | undefined) => `from 'di-bag${subpath ?? ''}'`)
      .replace("import type { Assert, Equal } from './assert';", assertions);
    const options: ts.CompilerOptions = {
      strict: true,
      declaration: true,
      emitDeclarationOnly: true,
      noUncheckedIndexedAccess: true,
      exactOptionalPropertyTypes: true,
      types: [],
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      rootDir: consumer,
      outDir: consumer,
    };
    const declarations = new Map<string, string>();
    const producerHost = ts.createCompilerHost(options);
    const readProducer = producerHost.getSourceFile.bind(producerHost);
    producerHost.getSourceFile = (name, version, onError, fresh) => name === featurePath
      ? ts.createSourceFile(name, source, version, true)
      : readProducer(name, version, onError, fresh);
    producerHost.writeFile = (name, text) => { declarations.set(name, text); };
    const producer = ts.createProgram([featurePath], options, producerHost);
    const emitted = producer.emit();
    expect([...ts.getPreEmitDiagnostics(producer), ...emitted.diagnostics]
      .map(error => ts.flattenDiagnosticMessageText(error.messageText, '\n'))).toEqual([]);
    const declarationEntry = [...declarations].find(([name]) => name.endsWith(`modern-feature.d.${extension}`));
    expect(declarationEntry).toBeDefined();
    const [declarationPath, declaration] = declarationEntry!;
    const consumerSource = readFileSync(resolve(__dirname, 'types/modern-inline-consumer.ts'), 'utf8')
      .replace(/from '(?:\.\.\/)+src'/g, "from 'di-bag'")
      .replace("from './modern-inline'", `from './modern-feature.${runtimeExtension}'`)
      .replace("import type { Assert, Equal } from './assert';", assertions);
    const { rootDir: _rootDir, outDir: _outDir, ...sharedConsumerOptions } = options;
    const consumerOptions: ts.CompilerOptions = {
      ...sharedConsumerOptions,
      declaration: false,
      emitDeclarationOnly: false,
      noEmit: true,
    };
    const consumerHost = ts.createCompilerHost(consumerOptions);
    consumerHost.resolveModuleNames = (names, containingFile) => names.map(name => {
      if (name === `./modern-feature.${runtimeExtension}`) {
        return {
          resolvedFileName: declarationPath,
          extension: mode === 'commonjs' ? ts.Extension.Dcts : ts.Extension.Dmts,
        };
      }
      return ts.resolveModuleName(name, containingFile, consumerOptions, consumerHost).resolvedModule;
    });
    const readConsumer = consumerHost.getSourceFile.bind(consumerHost);
    const exists = consumerHost.fileExists.bind(consumerHost);
    consumerHost.fileExists = name => name === featurePath ? false : name === declarationPath ? true : exists(name);
    consumerHost.getSourceFile = (name, version, onError, fresh) => name === featurePath ? undefined
      : name === declarationPath ? ts.createSourceFile(name, declaration, version, true)
        : name === consumerPath ? ts.createSourceFile(name, consumerSource, version, true)
          : readConsumer(name, version, onError, fresh);
    const consuming = ts.createProgram([consumerPath], consumerOptions, consumerHost);
    expect(consuming.getSourceFile(featurePath)).toBeUndefined();
    expect(consuming.getSourceFile(declarationPath)).toBeDefined();
    expect(ts.getPreEmitDiagnostics(consuming).map(error =>
      ts.flattenDiagnosticMessageText(error.messageText, '\n'))).toEqual([]);
  });

  for (const fixture of boxContractFixtures) {
    test(`installed ${mode} declaration contracts: ${fixture}`, () => {
      const path = join(consumer, `consumer.${mode === 'commonjs' ? 'cts' : 'mts'}`);
      const source = boxContractSource(fixture);
      const options: ts.CompilerOptions = { strict: true, noEmit: true, noUncheckedIndexedAccess: true,
        exactOptionalPropertyTypes: true, types: [], target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext };
      const host = ts.createCompilerHost(options); const original = host.getSourceFile.bind(host);
      host.getSourceFile = (name, version, onError, fresh) => name === path
        ? ts.createSourceFile(path, source, ts.ScriptTarget.ES2022, true) : original(name, version, onError, fresh);
      const errors = ts.getPreEmitDiagnostics(ts.createProgram([path], options, host));
      if (!fixture.startsWith('negative/')) expect(errors.map(error => ts.flattenDiagnosticMessageText(error.messageText, '\n'))).toEqual([]);
      else {
        expect(errors.every(error => error.file?.fileName === path)).toBe(true);
        expect(errors.some(error => error.code === 2589)).toBe(false);
        const matched = matchDiagnosticMarkers(source, path, errors.map(describeDiagnostic));
        expect(matched.missing).toEqual([]); expect(matched.unexpected).toEqual([]);
      }
    });
  }
}
