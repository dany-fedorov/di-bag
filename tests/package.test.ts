import { afterAll, beforeAll, expect, test } from 'bun:test';
import { join, resolve } from 'node:path';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import ts from 'typescript';
import { describeDiagnostic } from './compiler';
import { matchDiagnosticMarkers } from './diagnostic-markers';
import { startupRuntimeAssertions } from './startup-runtime-fixture';
import { selectedScopeRuntimeAssertions } from './selected-scope-runtime-fixture';
import { compositionAdapterRuntimeAssertions } from './composition-adapters-runtime-fixture';
import { dependencyReferenceRuntimeAssertions } from './dependency-references-runtime-fixture';
import { aliasRuntimeAssertions } from './aliases-runtime-fixture';
import { contributionRuntimeAssertions } from './contributions-runtime-fixture';
import { observerRuntimeAssertions } from './observers-runtime-fixture';
import { pluginRuntimeAssertions } from './plugins-runtime-fixture';
import { finalAdversarialExpectedResult, finalAdversarialPackageRuntimeSource } from './final-adversarial-runtime-fixture';
import { supervise } from '../scripts/native-process';
import { nativeLimits } from '../scripts/native-compiler';

const root = resolve(__dirname, '..');
const classicPackageConsumer = mkdtempSync(join(tmpdir(), 'di-bag-classic-package-consumer-'));
const classicPackageArtifacts = mkdtempSync(join(tmpdir(), 'di-bag-classic-package-artifacts-'));
let packageArchiveFiles: readonly string[] = [];

async function run(command: string[], cwd = root) {
  const { exitCode, stdout, stderr, signal, terminationReason } = await execute(command, cwd);
  expect({ exitCode, stderr, signal, terminationReason })
    .toEqual({ exitCode: 0, stderr: '', signal: null, terminationReason: undefined });
  return stdout.trim();
}

async function execute(command: string[], cwd = root) {
  const result = await supervise(command[0]!, command.slice(1), cwd,
    { ...nativeLimits, timeoutMilliseconds: 120_000 });
  return { exitCode: result.status, stdout: result.stdout, stderr: result.stderr,
    signal: result.signal, terminationReason: result.terminationReason };
}

beforeAll(async () => {
  // The self-reference fixtures below also need this checkout's fresh dist tree.
  await run(['npm', 'run', 'build']);
  const packed = JSON.parse(await run(['npm', 'pack', '--ignore-scripts', '--json', '--pack-destination', classicPackageArtifacts]));
  packageArchiveFiles = packed[0].files.map((entry: { path: string }) => entry.path);
  const archive = join(classicPackageArtifacts, packed[0].filename);
  await run(['npm', 'install', '--offline', '--ignore-scripts', '--no-audit', '--no-fund', '--no-package-lock', archive], classicPackageConsumer);
});

test('standalone archive contains root and node entries without removed adapters', () => {
  for (const entry of ['dist/index.d.ts', 'dist/index.js', 'dist/node.d.ts', 'dist/node.js']) expect(packageArchiveFiles).toContain(entry);
  expect(packageArchiveFiles.some(path => /(?:^|\/)(?:sas-box|val-box)\.(?:d\.ts|js)$/.test(path))).toBe(false);
});

afterAll(() => {
  rmSync(classicPackageConsumer, { recursive: true, force: true });
  rmSync(classicPackageArtifacts, { recursive: true, force: true });
});

test('feature library inferred token exports survive declaration emission', () => {
  const featurePath = resolve(__dirname, 'types/token-modules/feature.ts');
  const consumerPath = resolve(__dirname, 'types/token-modules/consumer.ts');
  const output = resolve(__dirname, 'generated-token-feature');
  const options: ts.CompilerOptions = {
    strict: true, declaration: true, emitDeclarationOnly: true,
    noUncheckedIndexedAccess: true, exactOptionalPropertyTypes: true,
    types: [], target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext,
    rootDir: resolve(__dirname, 'types/token-modules'), outDir: output,
  };
  const declarations = new Map<string, string>();
  const producerHost = ts.createCompilerHost(options);
  // Keep producer and consumer text unchanged; redirect only the package edge.
  producerHost.resolveModuleNames = (names, containingFile) => names.map(name =>
    name === '../../../src' ? { resolvedFileName: resolve(classicPackageConsumer, 'node_modules/di-bag/dist/index.d.ts'), extension: ts.Extension.Dts }
      : ts.resolveModuleName(name, containingFile, options, producerHost).resolvedModule);
  producerHost.writeFile = (name, text) => { declarations.set(name, text); };
  const producer = ts.createProgram([featurePath], options, producerHost);
  const emitted = producer.emit();
  expect([...ts.getPreEmitDiagnostics(producer), ...emitted.diagnostics].map(error => ts.flattenDiagnosticMessageText(error.messageText, '\n'))).toEqual([]);
  const declaration = declarations.get(resolve(output, 'feature.d.ts'));
  expect(declaration).toBeDefined();
  const consumerOptions = { ...options, noEmit: true, emitDeclarationOnly: false, rootDir: root };
  const consumerHost = ts.createCompilerHost(consumerOptions);
  consumerHost.resolveModuleNames = (names, containingFile) => names.map(name =>
    name === '../../../src' ? { resolvedFileName: resolve(classicPackageConsumer, 'node_modules/di-bag/dist/index.d.ts'), extension: ts.Extension.Dts }
      : ts.resolveModuleName(name, containingFile, consumerOptions, consumerHost).resolvedModule);
  const readConsumer = consumerHost.getSourceFile.bind(consumerHost);
  const declarationPath = featurePath.replace(/\.ts$/, '.d.ts');
  const exists = consumerHost.fileExists.bind(consumerHost);
  consumerHost.fileExists = name => name === featurePath ? false : name === declarationPath ? true : exists(name);
  consumerHost.getSourceFile = (name, version, onError, fresh) => name === featurePath ? undefined
    : name === declarationPath ? ts.createSourceFile(name, declaration!, version, true)
    : readConsumer(name, version, onError, fresh);
  const consumer = ts.createProgram([consumerPath], consumerOptions, consumerHost);
  expect(consumer.getSourceFile(featurePath)).toBeUndefined();
  expect(consumer.getSourceFile(declarationPath)).toBeDefined();
  expect(ts.getPreEmitDiagnostics(consumer).map(error => ts.flattenDiagnosticMessageText(error.messageText, '\n'))).toEqual([]);
});

for (const mode of ['commonjs', 'module'] as const) {
  test(`classic installed ${mode} archive rejects removed box package entry points`, async () => {
    expect(existsSync(join(classicPackageConsumer, 'node_modules/sas-box'))).toBe(false);
    expect(existsSync(join(classicPackageConsumer, 'node_modules/val-box'))).toBe(false);
    const load = mode === 'commonjs'
      ? "async specifier => { try { require(specifier); } catch (error) { return error.code; } }"
      : "async specifier => { try { await import(specifier); } catch (error) { return error.code; } }";
    const stdout = await run(['node', `--input-type=${mode}`, '--eval', `
      const load = ${load};
      Promise.all(['di-bag/sas-box', 'di-bag/val-box'].map(load))
        .then(codes => console.log(JSON.stringify(codes)));
    `], classicPackageConsumer);
    expect(JSON.parse(stdout)).toEqual(['ERR_PACKAGE_PATH_NOT_EXPORTED', 'ERR_PACKAGE_PATH_NOT_EXPORTED']);
  });

  test(`classic installed ${mode} archive returns the full adversarial oracle`, async () => {
    const executed = await execute(['node', `--input-type=${mode}`, '--eval', finalAdversarialPackageRuntimeSource(mode)], classicPackageConsumer);
    let result: unknown;
    try { result = JSON.parse(executed.stdout.trim()); } catch { result = undefined; }
    expect({ ...executed, stdout: executed.stdout.trim(), result }).toEqual({
      exitCode: 0, stdout: JSON.stringify(finalAdversarialExpectedResult), stderr: '', signal: null,
      terminationReason: undefined, result: finalAdversarialExpectedResult,
    });
  });

  test(`Node ${mode} consumers can resolve and dispose through the public package`, async () => {
    const load =
      mode === 'commonjs'
        ? "const packageExports = require('di-bag/node'); const { DiBag, DiBagCleanupError, DiBagPluginError } = packageExports;"
        : "import * as packageExports from 'di-bag/node'; const { DiBag, DiBagCleanupError, DiBagPluginError } = packageExports;";
    const stdout = await run([
      'node',
      `--input-type=${mode}`,
      '--eval',
      `${load}
      (async () => {
        ${startupRuntimeAssertions}
        ${selectedScopeRuntimeAssertions}
        ${compositionAdapterRuntimeAssertions}
        ${dependencyReferenceRuntimeAssertions}
        ${aliasRuntimeAssertions}
        ${contributionRuntimeAssertions}
        ${observerRuntimeAssertions}
        ${pluginRuntimeAssertions}
        let disposed;
        const mappedDisposal = [];
        const feature = DiBag.module().add({
          answer: DiBag.withMetadata(DiBag.withDisposal(() => 42, value => { disposed = value; }), { owner: 'package' }),
          privateValue: () => 7,
        }).exports(['answer']);
        const bag = DiBag.begin().install(feature.rename('answer', 'result')).end();
        const before = bag.inspect('result');
        const answer = bag.resolve('result');
        await bag.close();
        const cause = new Error('cleanup');
        const failing = DiBag.begin().add({
          resource: DiBag.withDisposal(() => 1, () => { throw cause; }),
        }).end();
        failing.resolve('resource');
        const error = await failing.close().catch(error => error);
        const raw = Promise.resolve(7);
        const mapped = DiBag.withDisposal(DiBag.mapSync(
          DiBag.withDisposal(() => raw, value => { mappedDisposal.push(value); }),
          value => { if (value !== raw) throw new Error('lost source identity'); return { promise: value }; },
        ), value => { mappedDisposal.push(value.promise === raw ? 'outer' : 'wrong'); });
        const mappedBag = DiBag.begin().add({ mapped, asyncMapped: DiBag.mapAsync(() => Promise.resolve(4), value => value + 1) }).end();
        const mappedIdentity = mappedBag.resolve('mapped').promise === raw;
        const asyncMapped = await mappedBag.resolve('asyncMapped');
        await mappedBag.close();
        const cjs = (await import('node:module')).createRequire(process.cwd() + '/consumer.cjs')('di-bag');
        const esm = await import('di-bag');
        const tokenKey = Symbol('package');
        const selected = cjs.DiBag.token(tokenKey).of();
        const tokenFeature = esm.DiBag.module().bind(selected, () => raw)
          .add({ value: esm.DiBag.mapSync(esm.DiBag.fromTokens([selected], value => value), value => value) }).exports([selected, 'value']);
        const tokenRuntime = DiBag.begin().install(tokenFeature).end();
        const tokenIdentity = tokenRuntime.resolve('value') === raw;
        await tokenRuntime.close();
        const scopeLog = [];
        let scopeId = 0;
        let rootDisposed = 0;
        let scopedDisposed = 0;
        let transientsDisposed = 0;
        const parent = DiBag.begin().add({
          service: DiBag.withDisposal(() => ++scopeId, value => { scopeLog.push(value); }),
          root: DiBag.withLifetime(DiBag.withDisposal(() => ({ owner: 'root' }), () => { rootDisposed++; }), 'root'),
          scoped: DiBag.withDisposal(() => ({ owner: 'scope' }), () => { scopedDisposed++; }),
          transient: DiBag.withLifetime(DiBag.withDisposal(() => ({ owner: 'call' }), () => { transientsDisposed++; }), 'transient'),
        }).end();
        const scope = parent.scope();
        const independent = scope.fork();
        const childRoot = scope.resolve('root');
        scope.resolve('scoped');
        const firstTransient = scope.resolve('transient');
        const secondTransient = scope.resolve('transient');
        if (parent.resolve('service') !== 1 || scope.resolve('service') !== 2)
          throw new Error('scope identity');
        if (scope.resolve('root') !== childRoot || parent.resolve('root') !== childRoot)
          throw new Error('root family identity');
        if (firstTransient === secondTransient) throw new Error('transient identity');
        independent.resolve('service');
        await scope.close();
        if (JSON.stringify(scopeLog) !== '[2]' || rootDisposed !== 0 || scopedDisposed !== 1 || transientsDisposed !== 2)
          throw new Error('lifetime child ownership');
        if (parent.resolve('root') !== childRoot) throw new Error('root closed with child');
        await parent.close();
        if (JSON.stringify(scopeLog) !== '[2,1]' || rootDisposed !== 1 || independent.resolve('service') !== 3)
          throw new Error('scope ownership');
        await independent.close();
        if (JSON.stringify(scopeLog) !== '[2,1,3]') throw new Error('fork ownership');
        console.log(JSON.stringify({ answer, disposed,
          publiclyConstructible: ['Bag', 'Module', 'Provider', 'ProviderBase'].some(key => Object.hasOwn(packageExports, key)),
          metadata: before.metadata.owner,
          inspectionIsStatic: before.acquisitions.length === 0 && bag.inspect('result').acquisitions.length === 0,
          frozenInspection: Object.isFrozen(before) && Object.isFrozen(before.metadata),
          cleanup: error instanceof DiBagCleanupError && error instanceof cjs.DiBagCleanupError && error instanceof esm.DiBagCleanupError,
          sameClass: cjs.DiBagCleanupError === esm.DiBagCleanupError,
          originalCause: error.errors[0] === cause && error.failures[0].error === cause,
          label: error.failures[0].label,
          mappedIdentity, asyncMapped, mappedDisposal, tokenIdentity, scopeLog,
          rootDisposed, scopedDisposed, transientsDisposed,
        }));
      })().catch(error => { console.error(error); process.exitCode = 1; });
    `,
    ]);
    expect(JSON.parse(stdout)).toEqual({ answer: 42, disposed: 42, publiclyConstructible: false,
      cleanup: true, sameClass: true, originalCause: true, label: 'resource',
      metadata: 'package', inspectionIsStatic: true, frozenInspection: true,
      mappedIdentity: true, asyncMapped: 5, mappedDisposal: ['outer', 7], tokenIdentity: true,
      scopeLog: [2, 1, 3], rootDisposed: 1, scopedDisposed: 1, transientsDisposed: 2 });
  });

  test(`Node ${mode} observes local and foreign native subclass state directly`, async () => {
    const load = mode === 'commonjs'
      ? "const { DiBag } = require('di-bag/node');"
      : "import { DiBag } from 'di-bag/node';";
    const stdout = await run([
      'node', `--input-type=${mode}`, '--eval',
      `${load}
      (async () => {
        const { runInNewContext } = await import('node:vm');
        class ServicePromise extends Promise {}
        const cases = [];
        for (const foreign of [false, true]) {
          const resource = { id: 'real' };
          const substituted = { id: 'substituted' };
          const original = foreign
            ? runInNewContext('(class ServicePromise extends Promise {}).resolve(resource)', { resource })
            : ServicePromise.resolve(resource);
          let thenCalls = 0;
          original.then = fulfilled => {
            thenCalls++;
            fulfilled?.(substituted);
            throw new Error('custom then');
          };
          const disposed = [];
          const bag = DiBag.begin().add({
            resource: DiBag.withDisposal(() => original, value => { disposed.push(value); }),
          }).end();
          const exposed = bag.resolve('resource');
          await bag.close();
          cases.push({ foreign, localInstance: original instanceof Promise,
            exposedIsOriginal: exposed === original, thenCalls, disposedCount: disposed.length,
            disposedIsReal: disposed[0] === resource });
        }
        console.log(JSON.stringify(cases));
      })().catch(error => { console.error(error); process.exitCode = 1; });`,
    ]);
    expect(JSON.parse(stdout)).toEqual([
      { foreign: false, localInstance: true, exposedIsOriginal: true, thenCalls: 0, disposedCount: 1, disposedIsReal: true },
      { foreign: true, localInstance: false, exposedIsOriginal: true, thenCalls: 0, disposedCount: 1, disposedIsReal: true },
    ]);
  });

  test(`TypeScript ${mode} consumers can use the emitted declarations`, () => {
    const path = resolve(
      __dirname,
      mode === 'commonjs' ? 'consumer.cts' : 'consumer.mts',
    );
    const source = `import { DiBag, DiBagCleanupError, type CleanupFailure, type Bag, type Module, type ModuleProvides, type ModuleRequires } from 'di-bag';
      function inspectCleanup(error: unknown): void {
        if (!(error instanceof DiBagCleanupError)) return;
        const aggregate: AggregateError = error;
        const failures: readonly CleanupFailure[] = error.failures;
        const acquisitionId: symbol = failures[0].acquisitionId;
        const bindingId: symbol = failures[0].bindingId;
        const label: string = failures[0].label;
        const cause: unknown = failures[0].error;
        // @ts-expect-error The failure collection is readonly.
        failures.push(failures[0]);
        // @ts-expect-error Failure identities are readonly.
        failures[0].acquisitionId = Symbol();
        // @ts-expect-error The aggregate's failure snapshot cannot be reassigned.
        error.failures = [];
        // @ts-expect-error Original causes remain unknown until narrowed.
        const message: string = failures[0].error.message;
        void [aggregate, acquisitionId, bindingId, label, cause];
      }
      const bag = DiBag.begin().add({
        value: DiBag.withDisposal(async () => 42, value => { const n: number = value; void n; }),
        clock: () => ({ now() { return 42; } }),
        service: ({ clock }: { clock: { now(): number } }) => ({
          stamp() { return clock.now(); },
        }),
      }).end();
      const value: Promise<number> = bag.resolve('value');
      const scoped = bag.fork(['clock'], {
        clock: () => ({ now() { return 7; } }),
      });
      const stamp = scoped.resolve('service').stamp();
      type Assert<T extends true> = T;
      type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends
        (<T>() => T extends B ? 1 : 2) ? true : false;
      const legacy: PromiseLike<number> = {
        then(fulfilled) { fulfilled?.(42); throw new Error('after fulfillment'); },
      };
      const converted = DiBag.begin().add({
        resource: DiBag.withDisposal(() => Promise.resolve(legacy), value => {
          const number: number = value;
          void number;
        }),
      }).end().resolve('resource');
      type Converted = Assert<Equal<typeof converted, Promise<number>>>;
      type Stamp = Assert<Equal<typeof stamp, number>>;
      const replaced = DiBag.begin().add({ clock: () => 1 })
        .replace('clock', () => ({ now() { return 7; } })).end();
      const clock = replaced.resolve('clock');
      type Clock = Assert<Equal<typeof clock, { now(): number }>>;
      const fresh: typeof bag = bag.fork();
      const typed: Bag<{ clock: () => { now(): number } }> = replaced;
      const feature = DiBag.module().add({
        clock: () => ({ now() { return Number(42); }, extra() { return true; } }),
        privateReader: ({ clock, logger }: { clock: { extra(): boolean }; logger: { log(message: string): void } }) => clock.extra(),
        read: ({ privateReader }: { privateReader: boolean }) => ({ read() { return privateReader; } }),
        promised: async () => 7,
      }).exports(['clock', 'read', 'promised']);
      type Public = ModuleProvides<typeof feature>;
      type Required = ModuleRequires<typeof feature>;
      type RequiredKeys = Assert<Equal<keyof Required, 'logger'>>;
      type PublicPromise = Assert<Equal<Public['promised'], Promise<number>>>;
      const annotated: typeof feature = feature;
      const installed = DiBag.begin().install(annotated).add({ logger: () => ({ log(_message: string) {} }) });
      const composed = installed.end();
      const child = composed.fork(['clock'], { clock: () => ({ now() { return 7; }, extra() { return false; } }) });
      const result = child.resolve('read').read();
      type Result = Assert<Equal<typeof result, boolean>>;
      const modulePromise: Promise<number> = child.resolve('promised');
      const asyncOverrides = {
        clock: () => ({ now() { return Number(7); }, extra() { return true; }, richer() { return 9; } }),
        promised: async ({ clock }: { clock: { richer(): number } }) => clock.richer(),
      };
      const asyncFork = composed.fork(['clock', 'promised'], asyncOverrides);
      const asyncPromise = asyncFork.resolve('promised');
      type AsyncPromise = Assert<Equal<typeof asyncPromise, Promise<number>>>;
      // @ts-expect-error Private providers are not public slots.
      child.resolve('privateReader');
      // @ts-expect-error All local provider requirements survive sealing.
      DiBag.begin().install(feature).end();
      // @ts-expect-error Private consumers survive host replacement.
      installed.replace('clock', () => ({ now() { return 7; } }));
      // @ts-expect-error A visible contract annotation cannot erase latent constraints.
      const erasedModule: Module<Public, Required> = feature;
      // @ts-expect-error Plain Bag annotations cannot erase installed constraints.
      const erasedBag: Bag<{ clock: () => Public['clock']; read: () => Public['read']; promised: () => Public['promised']; logger: () => Required['logger'] }> = composed;
      const plainBuilder = DiBag.begin().add({
        clock: (): Public['clock'] => ({ now() { return 1; }, extra() { return true; } }),
        read: (): Public['read'] => ({ read() { return true; } }),
        promised: async () => 7,
        logger: (): Required['logger'] => ({ log(_message: string) {} }),
      });
      // @ts-expect-error Builder annotation cannot erase installed constraints.
      const erasedBuilder: typeof plainBuilder = installed;
      const selfContained = DiBag.module().add({ a: () => 1, b: () => 2 }).exports(['a', 'b']);
      // @ts-expect-error The provided contract is invariant even without retained requirements.
      const fewerProvides: Module<{ a: number }, {}> = selfContained;
      // @ts-expect-error Structural copies lose module identity.
      DiBag.begin().install({ ...feature });
      // @ts-expect-error Export selections require a finite tuple.
      DiBag.module().add({ value: () => 1 }).exports(['value'] as string[]);
      // @ts-expect-error Renames cannot hide another exported slot.
      feature.rename('clock', 'read');
      const renamed = DiBag.begin().install(feature.rename('clock', 'other')).add({ logger: () => ({ log(_message: string) {} }) });
      // @ts-expect-error Renamed public references retain their consumer constraints.
      renamed.replace('other', () => ({ now() { return 7; } }));
      void [value, stamp, fresh, typed, scoped.close(), bag.close()];`;
    const options: ts.CompilerOptions = {
      strict: true,
      noEmit: true,
      types: [],
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
    };
    const host = ts.createCompilerHost(options);
    const getSourceFile = host.getSourceFile.bind(host);
    host.getSourceFile = (name, languageVersion, onError, fresh) =>
      name === path
        ? ts.createSourceFile(path, source, ts.ScriptTarget.ES2022, true)
        : getSourceFile(name, languageVersion, onError, fresh);
    const program = ts.createProgram([path], options, host);
    expect(
      ts
        .getPreEmitDiagnostics(program)
        .map((error) =>
          ts.flattenDiagnosticMessageText(error.messageText, '\n'),
        ),
    ).toEqual([]);
  });

  for (const fixture of ['plugins.ts', 'negative/plugins.ts', 'observers.ts', 'negative/observers.ts', 'contributions.ts', 'negative/contributions.ts', 'aliases.ts', 'negative/aliases.ts', 'dependency-references.ts', 'negative/dependency-references.ts', 'composition-adapters.ts', 'negative/composition-adapters.ts', 'selected-scopes.ts', 'negative/selected-scopes.ts', 'acquisition-mode.ts', 'negative/acquisition-mode.ts', 'scopes.ts', 'negative/scopes.ts', 'lifetimes.ts', 'negative/lifetimes.ts', 'tokens.ts', 'negative/tokens.ts', 'negative/token-modules.ts', 'token-contracts.ts', 'negative/token-contracts.ts', 'providers.ts', 'replacement-context.ts', 'negative/replacement-context.ts', 'negative/provider-boundaries.ts', 'negative/provider-module-metadata.ts', 'negative/provider-projections.ts']) {
    test(`TypeScript ${mode} emitted provider contracts: ${fixture}`, () => {
      const path = resolve(__dirname, `provider-consumer.${mode === 'commonjs' ? 'cts' : 'mts'}`);
      const source = readFileSync(resolve(__dirname, 'types', fixture), 'utf8')
        .replace(/from '(?:\.\.\/)+src\/([^']+)'/g, "from '../dist/$1'")
        .replace(/import\('(?:\.\.\/)+src\/token-types'\)/g, "import('../dist/token-types')")
        .replace(/import\('(?:\.\.\/)+src'\)/g, "import('di-bag')")
        .replace(/from '(?:\.\.\/)+src'/g, "from 'di-bag'")
        .replace("import type { Assert, Equal } from './assert';", `type Assert<T extends true> = T;
          type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;`);
      const options: ts.CompilerOptions = {
        strict: true, noEmit: true, noUncheckedIndexedAccess: true,
        exactOptionalPropertyTypes: true, types: [], target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext,
      };
      const host = ts.createCompilerHost(options);
      const original = host.getSourceFile.bind(host);
      host.getSourceFile = (name, version, onError, fresh) => name === path
        ? ts.createSourceFile(path, source, ts.ScriptTarget.ES2022, true)
        : original(name, version, onError, fresh);
      const errors = ts.getPreEmitDiagnostics(ts.createProgram([path], options, host));
      if (!fixture.startsWith('negative/')) {
        expect(errors.map(error => ts.flattenDiagnosticMessageText(error.messageText, '\n'))).toEqual([]);
      } else if (fixture === 'negative/observers.ts' || fixture === 'negative/contributions.ts' || fixture === 'negative/aliases.ts' || fixture === 'negative/dependency-references.ts' || fixture === 'negative/composition-adapters.ts' || fixture === 'negative/selected-scopes.ts' || fixture === 'negative/scopes.ts' || fixture === 'negative/lifetimes.ts') {
        const matched = matchDiagnosticMarkers(source, path, errors.map(describeDiagnostic));
        expect(matched.missing).toEqual([]);
        expect(matched.unexpected).toEqual([]);
      } else {
        expect(errors.every(error => error.file?.fileName === path)).toBe(true);
        const markers = [...source.matchAll(/\/\/ diagnostic: (.+)/g)];
        expect(markers.length).toBeGreaterThan(0);
        for (const [index, marker] of markers.entries()) {
          const end = markers[index + 1]?.index ?? source.length;
          const messages = errors.filter(error => error.start !== undefined && error.start >= marker.index && error.start < end)
            .map(error => ts.flattenDiagnosticMessageText(error.messageText, '\n')).join('\n');
          expect(messages).toContain(marker[1]!);
        }
      }
    });
  }
}

for (const [name, specifier] of [['Bag', 'di-bag'], ['Bag', '../src/di-bag'], ['Module', 'di-bag'], ['Module', '../src/module'], ['Provider', 'di-bag'], ['Provider', '../src/provider'], ['Token', 'di-bag'], ['Token', '../src/tokens']]) {
  test(`unchecked ${name} construction is rejected through ${specifier}`, () => {
    const path = resolve(__dirname, 'unchecked-consumer.cts');
    const source = `import { ${name} } from '${specifier}'; new ${name}({ value: () => 42 });`;
    const options: ts.CompilerOptions = {
      strict: true,
      noEmit: true,
      types: [],
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
    };
    const host = ts.createCompilerHost(options);
    const getSourceFile = host.getSourceFile.bind(host);
    host.getSourceFile = (name, languageVersion, onError, fresh) =>
      name === path
        ? ts.createSourceFile(path, source, ts.ScriptTarget.ES2022, true)
        : getSourceFile(name, languageVersion, onError, fresh);
    const errors = ts.getPreEmitDiagnostics(ts.createProgram([path], options, host));
    // The internal constructor shape may add consumer diagnostics; the export
    // itself must still prohibit value usage, with no declaration-file errors.
    const typeOnlyErrors = errors.filter(error => error.code === 1362);
    expect(typeOnlyErrors).toHaveLength(1);
    expect(typeOnlyErrors[0]?.file?.fileName).toBe(path);
    expect(errors.every(error => error.file?.fileName === path)).toBe(true);
    expect(ts.flattenDiagnosticMessageText(typeOnlyErrors[0]!.messageText, '\n'))
      .toContain("cannot be used as a value because it was exported using 'export type'");
  });
}
