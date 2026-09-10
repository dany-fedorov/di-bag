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
      ? "const { DiBag: Core } = require('di-bag'); const { DiBag } = require('di-bag/node');"
      : "import { DiBag as Core } from 'di-bag'; import { DiBag } from 'di-bag/node';";
    writeFileSync(file, `${load}
      (async () => {
        let release; const resource = { id: 7 };
        const pending = new Promise(resolve => { release = resolve; });
        Object.defineProperty(pending, 'then', { value: undefined });
        const key = Symbol('shared'); const token = Core.token(key).of();
        const disposed = [];
        const source = Core.withMetadata(() => pending, { dynamic: { mode: 'direct', describe: value => ({ samePromise: value === pending }) } });
        const owned = Core.withDisposal(source, value => { disposed.push(value === resource ? 'resource' : 'wrong'); });
        const bag = DiBag.createBuilder().register(token, owned).build();
        const acquired = bag.resolve(token);
        const identity = acquired === pending;
        const nativePromise = acquired instanceof Promise;
        const metadata = bag.inspect(token).acquisitions[0].acquisitionMetadata;
        const closing = bag.close(); await Promise.resolve(); await Promise.resolve();
        const before = [...disposed]; release(resource); await closing;
        let preflight = false; try { Core.createBuilder().register({ value: () => 1 }).build(); } catch { preflight = true; }
        const rawDisposed = [];
        const raw = Core.createBuilder().register({ value: Core.withDisposal(Core.fromFactory(() => pending, { acquisitionMode: 'raw' }), value => { rawDisposed.push(value === pending); }) }).build();
        raw.resolve('value'); await raw.close();
        console.log(JSON.stringify({ identity, nativePromise, metadata, before, disposed, preflight, rawDisposed }));
      })().catch(error => { console.error(error); process.exitCode = 1; });`);
    expect(JSON.parse(await run([runtime, file], consumer))).toEqual({ identity: true, nativePromise: true, metadata: [{ present: true, value: { samePromise: true } }], before: [], disposed: ['resource'], preflight: true, rawDisposed: [true] });
  });
}

for (const mode of ['commonjs', 'module'] as const) {
  test(`installed token composition crosses Node ${mode} and the other loader`, async () => {
    const load = mode === 'commonjs'
      ? "const first = require('di-bag'); const second = await import('di-bag/node');"
      : "const first = await import('di-bag'); const { createRequire } = await import('node:module'); const second = createRequire(process.cwd() + '/consumer.cjs')('di-bag/node');";
    const output = await run(['node', `--input-type=${mode}`, '--eval', `
      (async () => {
        ${load}
        const publicKey = Symbol('public');
        const publicToken = first.DiBag.token(publicKey).of();
        const samePublicToken = second.DiBag.token(publicKey).of();
        const promiseKey = Symbol('promise');
        const promiseToken = first.DiBag.token(promiseKey).of();
        const privateKey = Symbol('private');
        const privateToken = first.DiBag.token(privateKey).of();
        const raw = Promise.resolve(7);
        let privateIds = 0;
        const read = first.DiBag.fromFunction([publicToken, privateToken], (value, local) => ({ value: value.answer, privateId: local.id }));
        const promiseValue = first.DiBag.fromFunction([promiseToken], value => value);
        const feature = second.DiBag.createModuleBuilder().register(privateToken, () => ({ id: ++privateIds })).register({ read, promiseValue }).buildModule(['read', 'promiseValue']);
        const firstFeature = feature.renameExport('read', 'firstRead').renameExport('promiseValue', 'firstPromise');
        const secondFeature = feature.renameExport('read', 'secondRead').renameExport('promiseValue', 'secondPromise');
        const publicValue = { answer: 42 };
        const root = second.DiBag.createBuilder().installModule(firstFeature).installModule(secondFeature).register(publicToken, () => publicValue).register(promiseToken, () => raw).build();
        const rootPublic = root.resolve(samePublicToken);
        const rootFirst = root.resolve('firstRead');
        const rootSecond = root.resolve('secondRead');
        const rootPromiseIdentity = root.resolve('firstPromise') === raw && root.resolve('secondPromise') === raw;
        const childValue = { answer: 9 };
        const child = root.fork([samePublicToken], { [publicKey]: () => childValue });
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
