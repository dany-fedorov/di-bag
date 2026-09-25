import { afterAll, beforeAll, expect, test } from 'bun:test';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import ts from 'typescript';

const root = resolve(__dirname, '..');
const packed = mkdtempSync(join(tmpdir(), 'di-bag-token-pack-'));
const consumer = mkdtempSync(join(tmpdir(), 'di-bag-token-consumer-'));
const packageTree = mkdtempSync(join(tmpdir(), 'di-bag-token-package-tree-'));
let archive: string;

afterAll(() => {
  for (const directory of [packed, consumer, packageTree]) rmSync(directory, { recursive: true, force: true });
});

async function run(command: string[], cwd = root) {
  const child = Bun.spawn(command, { cwd, stdout: 'pipe', stderr: 'pipe' });
  const [code, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  expect({ code, stderr: code === 0 ? '' : stderr }).toEqual({ code: 0, stderr: '' });
  return stdout;
}

beforeAll(async () => {
  for (const file of ['src', 'package.json', 'tsconfig.json', 'tsconfig.build.json', 'README.md', 'LICENSE']) cpSync(join(root, file), join(packageTree, file), { recursive: true });
  symlinkSync(join(root, 'node_modules'), join(packageTree, 'node_modules'));
  await run(['npm', 'run', 'build'], packageTree);
  const result = JSON.parse(await run(['npm', 'pack', '--ignore-scripts', '--json', '--pack-destination', packed], packageTree));
  archive = join(packed, result[0].filename);
  await run(['npm', 'install', '--offline', '--ignore-scripts', '--no-audit', '--no-fund', '--no-package-lock', archive], consumer);
});

for (const runtime of ['node', 'bun']) for (const extension of ['cjs', 'mjs']) {
  test(`installed ${runtime} ${extension} facade shares core tokens, modes and acquisition metadata`, async () => {
    const file = join(consumer, `${runtime}-facade.${extension}`);
    const load = extension === 'cjs'
      ? "const { DiBag: Core } = require('di-bag'); const { DiBag } = require('di-bag');"
      : "import { DiBag as Core } from 'di-bag'; import { DiBag } from 'di-bag';";
    writeFileSync(file, `${load}
      (async () => {
        let release; const resource = { id: 7 };
        const pending = new Promise(resolve => { release = resolve; });
        Object.defineProperty(pending, 'then', { value: undefined });
        const key = Symbol('shared'); const token = Core.createToken(key).forService();
        const disposed = [];
        const source = Core.providerWithAcquisitionMetadata({ provider: () => pending, describeAcquisition: value => ({ samePromise: value === pending }), callbackReceives: 'exposed-service' });
        const owned = Core.providerWithDisposal({ provider: source, disposeService: value => { disposed.push(value === resource ? 'resource' : 'wrong'); } });
        const bag = DiBag.createBuilder().withTokenService(token, owned).buildContainer();
        const acquired = bag.resolve(token);
        const identity = acquired === pending;
        const isNativePromise = acquired instanceof Promise;
        const metadata = bag.serviceSnapshot(token).acquisitions[0].acquisitionMetadata;
        const closing = bag.close(); await Promise.resolve(); await Promise.resolve();
        const before = [...disposed]; release(resource); await closing;
        // Simulate a host without process.getBuiltinModule, where the bare entry must reject automatic stages.
        const loader = Object.getOwnPropertyDescriptor(process, 'getBuiltinModule');
        Object.defineProperty(process, 'getBuiltinModule', { configurable: true, writable: true, value: undefined });
        let preflight = false; try { Core.createBuilder().withServices({ value: () => 1 }).buildContainer(); } catch (error) { preflight = error.code === 'DI_BAG_CLASSIFIER_REQUIRED'; }
        finally { Object.defineProperty(process, 'getBuiltinModule', loader); }
        const detected = Core.createBuilder().withServices({ value: async () => 1 }).buildContainer();
        preflight = preflight && await detected.resolve('value') === 1; await detected.close();
        const rawDisposed = [];
        const raw = Core.createBuilder().withServices({ value: Core.providerWithDisposal({ provider: Core.createProvider(() => pending, { factoryReturnKind: 'uninspected' }), disposeService: value => { rawDisposed.push(value === pending); } }) }).buildContainer();
        raw.resolve('value'); await raw.close();
        console.log(JSON.stringify({ identity, isNativePromise, metadata, before, disposed, preflight, rawDisposed }));
      })().catch(error => { console.error(error); process.exitCode = 1; });`);
    expect(JSON.parse(await run([runtime, file], consumer))).toEqual({ identity: true, isNativePromise: true, metadata: [{ isPresent: true, value: { samePromise: true } }], before: [], disposed: ['resource'], preflight: true, rawDisposed: [true] });
  });
}

for (const mode of ['commonjs', 'module'] as const) {
  test(`installed token composition crosses Node ${mode} and the other loader`, async () => {
    const load = mode === 'commonjs'
      ? "const first = require('di-bag'); const second = await import('di-bag');"
      : "const first = await import('di-bag'); const { createRequire } = await import('node:module'); const second = createRequire(process.cwd() + '/consumer.cjs')('di-bag');";
    const output = await run(['node', `--input-type=${mode}`, '--eval', `
      (async () => {
        ${load}
        const publicKey = Symbol('public');
        const publicToken = first.DiBag.createToken(publicKey).forService();
        const samePublicToken = second.DiBag.createToken(publicKey).forService();
        const promiseKey = Symbol('promise');
        const promiseToken = first.DiBag.createToken(promiseKey).forService();
        const privateKey = Symbol('private');
        const privateToken = first.DiBag.createToken(privateKey).forService();
        const raw = Promise.resolve(7);
        let privateIds = 0;
        const read = first.DiBag.createProviderFromFunction({ dependencies: [publicToken, privateToken], factoryFunction: (value, local) => ({ value: value.answer, privateId: local.id }) });
        const promiseValue = first.DiBag.createProviderFromFunction({ dependencies: [promiseToken], factoryFunction: value => value });
        const feature = second.DiBag.createBuilder().withTokenService(privateToken, () => ({ id: ++privateIds })).withServices({ read, promiseValue }).buildModule({ exportedServiceKeys: ['read', 'promiseValue'] });
        const firstFeature = feature.withRenamedExport({ currentExportKey: 'read', newExportKey: 'firstRead' }).withRenamedExport({ currentExportKey: 'promiseValue', newExportKey: 'firstPromise' });
        const secondFeature = feature.withRenamedExport({ currentExportKey: 'read', newExportKey: 'secondRead' }).withRenamedExport({ currentExportKey: 'promiseValue', newExportKey: 'secondPromise' });
        const publicValue = { answer: 42 };
        const root = second.DiBag.createBuilder().withInstalledModules([firstFeature]).withInstalledModules([secondFeature]).withTokenService(publicToken, () => publicValue).withTokenService(promiseToken, () => raw).buildContainer();
        const rootPublic = root.resolve(samePublicToken);
        const rootFirst = root.resolve('firstRead');
        const rootSecond = root.resolve('secondRead');
        const rootPromiseIdentity = root.resolve('firstPromise') === raw && root.resolve('secondPromise') === raw;
        const childValue = { answer: 9 };
        const child = root.createIndependentContainer([samePublicToken], { [publicKey]: () => childValue });
        const childFirst = child.resolve('firstRead');
        const childSecond = child.resolve('secondRead');
        const childPromiseIdentity = child.resolve('firstPromise') === raw;
        await child.close();
        await root.close();
        console.log(JSON.stringify({
          rootPublicIdentity: rootPublic === publicValue,
          rootFirst,
          rootSecond,
          childFirst,
          childSecond,
          rootPromiseIdentity,
          childPromiseIdentity,
        }));
      })().catch(error => { console.error(error); process.exitCode = 1; });
    `], consumer);
    expect(JSON.parse(output)).toEqual({
      rootPublicIdentity: true,
      rootFirst: { value: 42, privateId: 1 },
      rootSecond: { value: 42, privateId: 2 },
      childFirst: { value: 9, privateId: 3 },
      childSecond: { value: 9, privateId: 4 },
      rootPromiseIdentity: true,
      childPromiseIdentity: true,
    });
  });

  for (const feature of ['token-modules', 'incremental-modules', 'replacement-reflection'] as const) test(`installed ${mode} ${feature} declaration survives emission and unchanged consumption`, () => {
    const extension = mode === 'commonjs' ? 'cts' : 'mts';
    const runtimeExtension = mode === 'commonjs' ? 'cjs' : 'mjs';
    const featurePath = join(consumer, `${feature}-feature.${extension}`);
    const consumerPath = join(consumer, `${feature}-consumer.${extension}`);
    const output = consumer;
    // Keep the feature author and consumer unchanged; redirect only their
    // package and emitted-feature resolution edges into this installed archive.
    const producerFixture = feature === 'token-modules' ? 'types/token-modules/feature.ts'
      : feature === 'incremental-modules' ? 'types/incremental-modules.ts'
        : 'types/replacement-reflection.ts';
    const consumerFixture = feature === 'token-modules' ? 'types/token-modules/consumer.ts'
      : feature === 'incremental-modules' ? 'types/incremental-modules-consumer.ts'
        : 'types/replacement-reflection-consumer.ts';
    const source = readFileSync(resolve(__dirname, producerFixture), 'utf8').replace("import type { Assert, Equal } from './assert';", "type Assert<T extends true> = T; type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;").replace(/from '(?:\.\.\/)+src\/(module-types)'/g, "from './node_modules/di-bag/dist/$1.js'").replace(/from '(?:\.\.\/)+src(\/[^']+)?'/g, (_match, subpath: string | undefined) => `from 'di-bag${subpath ?? ''}'`);
    writeFileSync(featurePath, source);
    expect(existsSync(featurePath)).toBe(true);
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
      outDir: output,
    };
    const declarations = new Map<string, string>();
    const producerHost = ts.createCompilerHost(options);
    const readProducer = producerHost.getSourceFile.bind(producerHost);
    producerHost.getSourceFile = (name, version, onError, fresh) => name === featurePath
      ? ts.createSourceFile(name, source, version, true)
      : readProducer(name, version, onError, fresh);
    producerHost.writeFile = (name, text) => { declarations.set(name, text); writeFileSync(name, text); };
    const producer = ts.createProgram([featurePath], options, producerHost);
    const emitted = producer.emit();
    expect([...ts.getPreEmitDiagnostics(producer), ...emitted.diagnostics].map(error => ts.flattenDiagnosticMessageText(error.messageText, '\n'))).toEqual([]);
    const declarationEntry = [...declarations].find(([name]) => name.endsWith(`${feature}-feature.d.${extension}`));
    expect(declarationEntry).toBeDefined();
    const [declarationPath, declaration] = declarationEntry!;
    expect(existsSync(declarationPath)).toBe(true);
    rmSync(featurePath);
    expect(existsSync(featurePath)).toBe(false);
    const consumerSource = readFileSync(resolve(__dirname, consumerFixture), 'utf8').replace(/from '(?:\.\.\/)+src(\/[^']+)?'/g, (_match, subpath: string | undefined) => `from 'di-bag${subpath ?? ''}'`).replace(feature === 'token-modules' ? "from './feature'"
        : feature === 'incremental-modules' ? "from './incremental-modules'"
          : "from './replacement-reflection'", `from './${feature}-feature.${runtimeExtension}'`);
    const { rootDir: _rootDir, outDir: _outDir, ...sharedConsumerOptions } = options;
    const consumerOptions: ts.CompilerOptions = { ...sharedConsumerOptions, declaration: false, emitDeclarationOnly: false, noEmit: true };
    const consumerHost = ts.createCompilerHost(consumerOptions);
    const assertPath = resolve(__dirname, 'types/assert.ts');
    consumerHost.resolveModuleNames = (names, containingFile) => names.map(name => {
      if (name === `./${feature}-feature.${runtimeExtension}`) {
        return { resolvedFileName: declarationPath, extension: mode === 'commonjs' ? ts.Extension.Dcts : ts.Extension.Dmts };
      }
      if (name === '../assert' || name === './assert') return { resolvedFileName: assertPath, extension: ts.Extension.Ts };
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
    expect(ts.getPreEmitDiagnostics(consuming).map(error => ts.flattenDiagnosticMessageText(error.messageText, '\n'))).toEqual([]);
  });
}
