import { afterAll, beforeAll, expect, test } from 'bun:test';
import { cpSync, mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import ts from 'typescript';
import { boxContractFixtures, boxContractSource } from './box-contract-fixtures';
import { matchDiagnosticMarkers } from './diagnostic-markers';
import { describeDiagnostic } from './compiler';

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

async function run(command: string[], cwd = root) {
  const child = Bun.spawn(command, { cwd, stdout: 'pipe', stderr: 'pipe' });
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
  expect({ code, stderr: code === 0 ? '' : stderr }).toEqual({ code: 0, stderr: '' });
  return stdout;
}

beforeAll(async () => {
  for (const file of ['src', 'package.json', 'tsconfig.json', 'tsconfig.build.json']) cpSync(join(root, file), join(packageTree, file), { recursive: true });
  await run(['node', join(root, 'node_modules/typescript/bin/tsc6'), '-p', 'tsconfig.build.json'], packageTree);
  const result = JSON.parse(await run(['npm', 'pack', '--ignore-scripts', '--json', '--pack-destination', packed], packageTree));
  archive = join(packed, result[0].filename);
  const files: string[] = result[0].files.map((entry: { path: string }) => entry.path);
  expect(files.some(path => path.includes('fixtures') || path.endsWith('.tgz') || path.includes('node_modules'))).toBe(false);
  for (const name of ['sas-box', 'val-box']) {
    expect(files.filter(path => path.includes(name))).toEqual([`dist/${name}.d.ts`, `dist/${name}.js`]);
  }
  await run(['npm', 'install', '--offline', '--ignore-scripts', '--no-audit', '--no-fund', '--no-package-lock', archive,
    join(fixtures, 'sas-box-0.1.0.tgz'), join(fixtures, 'val-box-0.1.0.tgz')], consumer);
  await run(['npm', 'install', '--offline', '--ignore-scripts', '--no-audit', '--no-fund', '--no-package-lock', archive], coreConsumer);
});

test('real fixtures retain the verified archive hashes', () => {
  for (const [name, expected] of [
    ['sas-box', '1df071c09f98ae59141986622f174a1180d28835acd4aef2d7aac5339e5e5debfeb4d9c5de9f32d87181f92183c3a18af1ac4b84a4baec43971b3aec62d329db'],
    ['val-box', '3e4a4b9fbdb39523eab607f2f758e65fa86e919251655ca31e4905c2c4e3c12c3f214a54f64a4929ce01abac7d2ee92df105e51e614c4831d356c8c669cc7ed8'],
  ]) expect(createHash('sha512').update(new Uint8Array(readFileSync(join(fixtures, `${name}-0.1.0.tgz`)))).digest('hex')).toBe(expected!);
});

test('packed core runs with neither box installed and no runtime adapter import', async () => {
  expect(existsSync(join(coreConsumer, 'node_modules/sas-box'))).toBe(false);
  expect(existsSync(join(coreConsumer, 'node_modules/val-box'))).toBe(false);
  const output = await run(['node', '--eval', `const { DiBag } = require('di-bag');
    const bag = DiBag.begin().add({ answer: () => 42 }).end();
    if (Object.keys(require.cache).some(path => /dist[/\\\\](sas-box|val-box)\\.js$/.test(path))) throw new Error('adapter loaded');
    console.log(bag.resolve('answer')); bag.close();`], coreConsumer);
  expect(output.trim()).toBe('42');
});

for (const mode of ['commonjs', 'module'] as const) {
  test(`installed real boxes compose in Node ${mode} and share cross-loader descriptors`, async () => {
    const load = mode === 'commonjs'
      ? `const { DiBag } = require('di-bag'); const { fromSasBox } = require('di-bag/sas-box'); const { fromValBox } = require('di-bag/val-box'); const { SasBox } = require('sas-box'); const { ValBox } = require('val-box');`
      : `import { DiBag } from 'di-bag'; import { fromSasBox } from 'di-bag/sas-box'; import { fromValBox } from 'di-bag/val-box'; import { SasBox } from 'sas-box'; import { ValBox } from 'val-box';`;
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
        const tokenRuntime = cjs('di-bag').DiBag.begin().install(tokenFeature).end();
        const tokenIdentity = tokenRuntime.resolve('tokenProvider') === payload;
        const tokenPromiseIdentity = tokenRuntime.resolve('tokenPromise') === rawPromise;
        const tokenInspection = tokenRuntime.inspect('tokenProvider');
        await tokenRuntime.close();
        const provider = fromValBox(fromSasBox(() => SasBox.fromValue(raw), { mode: 'sync' }));
        const bag = cjs('di-bag').DiBag.begin().add({
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
        const matched = matchDiagnosticMarkers(source, path, errors.map(describeDiagnostic));
        expect(matched.missing).toEqual([]); expect(matched.unexpected).toEqual([]);
      }
    });
  }
}
