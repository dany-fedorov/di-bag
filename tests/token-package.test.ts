import { afterAll, beforeAll, expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import ts from 'typescript';

const root = resolve(__dirname, '..');
const packed = mkdtempSync(join(tmpdir(), 'di-bag-token-pack-'));
const consumer = mkdtempSync(join(tmpdir(), 'di-bag-token-consumer-'));
let archive: string;

afterAll(() => {
  for (const directory of [packed, consumer]) rmSync(directory, { recursive: true, force: true });
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
  await run(['node', 'node_modules/typescript/bin/tsc6', '-p', 'tsconfig.build.json']);
  const result = JSON.parse(await run(['npm', 'pack', '--ignore-scripts', '--json', '--pack-destination', packed]));
  archive = join(packed, result[0].filename);
  await run(['npm', 'install', '--offline', '--ignore-scripts', '--no-audit', '--no-fund', '--no-package-lock', archive], consumer);
});

for (const runtime of ['node', 'bun']) for (const extension of ['cjs', 'mjs']) {
  test(`installed ${runtime} ${extension} facade shares core tokens, modes and adapters`, async () => {
    const file = join(consumer, `${runtime}-facade.${extension}`);
    const load = extension === 'cjs'
      ? "const { DiBag: Core } = require('di-bag'); const { DiBag } = require('di-bag/node'); const { fromValBox } = require('di-bag/val-box');"
      : "import { DiBag as Core } from 'di-bag'; import { DiBag } from 'di-bag/node'; import { fromValBox } from 'di-bag/val-box';";
    writeFileSync(file, `${load}
      (async () => {
        let release; const resource = { id: 7 };
        const pending = new Promise(resolve => { release = resolve; });
        Object.defineProperty(pending, 'then', { value: undefined });
        const key = Symbol('shared'); const token = Core.token(key).of();
        const disposed = [];
        const source = Core.factory(() => ({ snapshot: () => ({ value: { present: true, value: pending }, metadata: { present: false }, alias: null }) }), { acquisition: 'raw' });
        const owned = Core.withDisposal(fromValBox(source), value => { disposed.push(value === resource ? 'resource' : 'wrong'); });
        const bag = DiBag.begin().bind(token, owned).end();
        const identity = bag.resolve(token) === pending;
        const closing = bag.close(); await Promise.resolve(); await Promise.resolve();
        const before = [...disposed]; release(resource); await closing;
        let preflight = false; try { Core.begin().add({ value: () => 1 }).end(); } catch { preflight = true; }
        const rawDisposed = [];
        const raw = Core.begin().add({ value: Core.withDisposal(Core.factory(() => pending, { acquisition: 'raw' }), value => { rawDisposed.push(value === pending); }) }).end();
        raw.resolve('value'); await raw.close();
        console.log(JSON.stringify({ identity, before, disposed, preflight, rawDisposed }));
      })().catch(error => { console.error(error); process.exitCode = 1; });`);
    expect(JSON.parse(await run([runtime, file], consumer))).toEqual({ identity: true, before: [], disposed: ['resource'], preflight: true, rawDisposed: [true] });
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
        const read = first.DiBag.fromTokens([publicToken, privateToken], (value, local) => ({ value: value.answer, privateId: local.id }));
        const promiseValue = first.DiBag.fromTokens([promiseToken], value => value);
        const feature = second.DiBag.module().bind(privateToken, () => ({ id: ++privateIds }))
          .add({ read, promiseValue }).exports(['read', 'promiseValue']);
        const firstFeature = feature.rename('read', 'firstRead').rename('promiseValue', 'firstPromise');
        const secondFeature = feature.rename('read', 'secondRead').rename('promiseValue', 'secondPromise');
        const publicValue = { answer: 42 };
        const root = second.DiBag.begin().install(firstFeature).install(secondFeature)
          .bind(publicToken, () => publicValue).bind(promiseToken, () => raw).end();
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

  test(`installed ${mode} token-module declaration survives emission and unchanged consumption`, () => {
    const extension = mode === 'commonjs' ? 'cts' : 'mts';
    const runtimeExtension = mode === 'commonjs' ? 'cjs' : 'mjs';
    const featurePath = join(consumer, `feature.${extension}`);
    const consumerPath = join(consumer, `consumer.${extension}`);
    const output = consumer;
    // Keep the Task2 feature author and consumer unchanged; redirect only their
    // package and emitted-feature resolution edges into this installed archive.
    const source = readFileSync(resolve(__dirname, 'types/token-modules/feature.ts'), 'utf8')
      .replace("from '../../../src'", "from 'di-bag'");
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
    producerHost.writeFile = (name, text) => { declarations.set(name, text); };
    const producer = ts.createProgram([featurePath], options, producerHost);
    const emitted = producer.emit();
    expect([...ts.getPreEmitDiagnostics(producer), ...emitted.diagnostics].map(error => ts.flattenDiagnosticMessageText(error.messageText, '\n'))).toEqual([]);
    const declarationEntry = [...declarations].find(([name]) => name.endsWith(`feature.d.${extension}`));
    expect(declarationEntry).toBeDefined();
    const [declarationPath, declaration] = declarationEntry!;
    const consumerSource = readFileSync(resolve(__dirname, 'types/token-modules/consumer.ts'), 'utf8')
      .replace("from '../../../src'", "from 'di-bag'")
      .replace("from './feature'", `from './feature.${runtimeExtension}'`);
    const { rootDir: _rootDir, outDir: _outDir, ...sharedConsumerOptions } = options;
    const consumerOptions: ts.CompilerOptions = { ...sharedConsumerOptions, declaration: false, emitDeclarationOnly: false, noEmit: true };
    const consumerHost = ts.createCompilerHost(consumerOptions);
    const assertPath = resolve(__dirname, 'types/assert.ts');
    consumerHost.resolveModuleNames = (names, containingFile) => names.map(name => {
      if (name === `./feature.${runtimeExtension}`) {
        return { resolvedFileName: declarationPath, extension: mode === 'commonjs' ? ts.Extension.Dcts : ts.Extension.Dmts };
      }
      if (name === '../assert') return { resolvedFileName: assertPath, extension: ts.Extension.Ts };
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
