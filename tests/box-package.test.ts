import { afterAll, beforeAll, expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import ts from 'typescript';

const root = resolve(__dirname, '..');
const fixtures = resolve(__dirname, 'fixtures/box-packages');
const packed = mkdtempSync(join(tmpdir(), 'di-bag-box-pack-'));
const consumer = mkdtempSync(join(tmpdir(), 'di-bag-box-consumer-'));
const coreConsumer = mkdtempSync(join(tmpdir(), 'di-bag-core-consumer-'));
let archive: string;

afterAll(() => {
  for (const directory of [packed, consumer, coreConsumer]) rmSync(directory, { recursive: true, force: true });
});

async function run(command: string[], cwd = root) {
  const child = Bun.spawn(command, { cwd, stdout: 'pipe', stderr: 'pipe' });
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
  expect({ code, stderr: code === 0 ? '' : stderr }).toEqual({ code: 0, stderr: '' });
  return stdout;
}

beforeAll(async () => {
  await run(['node', 'node_modules/typescript/bin/tsc', '-p', 'tsconfig.build.json']);
  const result = JSON.parse(await run(['npm', 'pack', '--ignore-scripts', '--json', '--pack-destination', packed]));
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

  for (const fixture of ['tokens.ts', 'negative/tokens.ts', 'negative/token-modules.ts', 'token-contracts.ts', 'negative/token-contracts.ts', 'box-adapters.ts', 'negative/box-adapters.ts', 'negative/provider-unions.ts', 'real']) {
    test(`installed ${mode} declaration contracts: ${fixture}`, () => {
      const path = join(consumer, `consumer.${mode === 'commonjs' ? 'cts' : 'mts'}`);
      const assertions = `type Assert<T extends true> = T; type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;`;
      const source = fixture === 'real' ? `
        import { DiBag, type ProviderOutput, type ProviderAcquisitionMetadata, type ValBoxFrame } from 'di-bag';
        import { fromSasBox } from 'di-bag/sas-box'; import { fromValBox, fromValBoxAsync } from 'di-bag/val-box';
        import { SasBox } from 'sas-box'; import { ValBox } from 'val-box'; ${assertions}
        const sync = fromSasBox(() => SasBox.fromValue(Promise.resolve(42)), { mode: 'sync' });
        const async = fromSasBox(() => SasBox.fromAsync(async () => 7), { mode: 'sync-first' });
        declare const unknown: SasBox.Unknown<Promise<number>>;
        const first = fromSasBox(() => unknown, { mode: 'sync-first' });
        const boxed = new ValBox.WithValue.WithMetadata(Promise.resolve(1), { owner: 'db' });
        const val = fromValBox(() => boxed); const awaited = fromValBoxAsync(async () => boxed);
        type Contracts = [Assert<Equal<ProviderOutput<typeof sync>, Promise<number>>>, Assert<Equal<ProviderOutput<typeof async>, Promise<number>>>,
          Assert<Equal<ProviderOutput<typeof first>, Promise<number>>>, Assert<Equal<ProviderOutput<typeof val>, Promise<number>>>,
          Assert<Equal<ProviderOutput<typeof awaited>, Promise<number>>>, Assert<Equal<ProviderAcquisitionMetadata<typeof val>, readonly [ValBoxFrame<{ owner: string }>]>>];
        const bag = DiBag.begin().add({ sync, async, first, val, awaited }).end(); void bag.close();
        // @ts-expect-error Async boxes have no sync route.
        fromSasBox(() => SasBox.fromAsync(async () => 7), { mode: 'sync' });
      ` : readFileSync(resolve(__dirname, 'types', fixture), 'utf8')
        .replace(/from '(?:\.\.\/)+src\/(provider|tokens|token-types|module-types)'/g, "from './node_modules/di-bag/dist/$1.js'")
        .replace(/import\('(?:\.\.\/)+src\/token-types'\)/g, "import('./node_modules/di-bag/dist/token-types.js')")
        .replace("import('../../src')", "import('di-bag')")
        .replace(/from '(?:\.\.\/)+src(\/[^']+)?'/g, (_match, subpath: string | undefined) => `from 'di-bag${subpath ?? ''}'`)
        .replace("import type { Assert, Equal } from './assert';", assertions);
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
        const markers = [...source.matchAll(/\/\/ diagnostic: (.+)/g)];
        for (const [index, marker] of markers.entries()) {
          const end = markers[index + 1]?.index ?? source.length;
          expect(errors.filter(error => error.start !== undefined && error.start >= marker.index && error.start < end)
            .map(error => ts.flattenDiagnosticMessageText(error.messageText, '\n')).join('\n')).toContain(marker[1]!);
        }
      }
    });
  }
}
