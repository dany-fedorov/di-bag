import { expect, test } from 'bun:test';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import ts from 'typescript';
import { execFileSync } from 'node:child_process';
import { boxContractFixtures, boxContractSource } from './box-contract-fixtures';
import { compileNative, nativeLimits, resolveNative } from '../scripts/native-compiler.ts';
import { matchNativeDiagnosticMarkers } from './native-diagnostic-markers.ts';
import { supervise } from '../scripts/native-process.ts';
import { startupRuntimeAssertions } from './startup-runtime-fixture';
import { selectedScopeRuntimeAssertions } from './selected-scope-runtime-fixture';
import { compositionAdapterRuntimeAssertions } from './composition-adapters-runtime-fixture';
import { dependencyReferenceRuntimeAssertions } from './dependency-references-runtime-fixture';
import { aliasRuntimeAssertions } from './aliases-runtime-fixture';
import { contributionRuntimeAssertions } from './contributions-runtime-fixture';
import { observerRuntimeAssertions } from './observers-runtime-fixture';
import { pluginRuntimeAssertions } from './plugins-runtime-fixture';

const root = resolve(__dirname, '..');
const node = execFileSync('node', ['-p', 'process.execPath'], { encoding: 'utf8', timeout: 10000 }).trim();
const bun = process.execPath;
const npmCli = realpathSync(join(dirname(node), 'npm'));
const replacementNativeGapCounts: Readonly<Record<string, number>> = {
  'negative/incremental.ts': 4,
  'negative/inline-replacement-wrong-shape.ts': 1,
  'negative/module-hidden-private-needs.ts': 1,
  'negative/module-narrowing.ts': 1,
  'negative/module-rename.ts': 1,
  'negative/provider-boundaries.ts': 1,
  'negative/replacement-context.ts': 12,
  'negative/replacement-wrong-shape.ts': 1,
  'negative/required-this.ts': 1,
  'negative/union-replace.ts': 4,
};
const scopeRuntimeSource = (extension: 'cts' | 'mts') => `${extension === 'cts'
  ? "const { DiBag, DiBagPluginError } = require('di-bag/node'); const assert = require('node:assert/strict');"
  : "import { DiBag, DiBagPluginError } from 'di-bag/node'; import assert from 'node:assert/strict';"}
(async () => {
  const log = [];
  let id = 0;
  let rootDisposed = 0;
  let scopedDisposed = 0;
  let transientsDisposed = 0;
  const parent = DiBag.begin().add({
    service: DiBag.withDisposal(() => ++id, value => { log.push(value); }),
    root: DiBag.withLifetime(DiBag.withDisposal(() => ({ owner: 'root' }), () => { rootDisposed++; }), 'root'),
    scoped: DiBag.withDisposal(() => ({ owner: 'scope' }), () => { scopedDisposed++; }),
    transient: DiBag.withLifetime(DiBag.withDisposal(() => ({ owner: 'call' }), () => { transientsDisposed++; }), 'transient'),
  }).end();
  const child = parent.scope();
  const independent = child.fork();
  const childRoot = child.resolve('root');
  child.resolve('scoped');
  const firstTransient = child.resolve('transient');
  const secondTransient = child.resolve('transient');
  assert.equal(parent.resolve('service'), 1);
  assert.equal(child.resolve('service'), 2);
  assert.equal(child.resolve('root'), childRoot);
  assert.equal(parent.resolve('root'), childRoot);
  assert.notEqual(firstTransient, secondTransient);
  independent.resolve('service');
  await child.close();
  assert.deepEqual(log, [2]);
  assert.equal(rootDisposed, 0);
  assert.equal(scopedDisposed, 1);
  assert.equal(transientsDisposed, 2);
  assert.equal(parent.resolve('root'), childRoot);
  await parent.close();
  assert.deepEqual(log, [2, 1]);
  assert.equal(rootDisposed, 1);
  assert.equal(independent.resolve('service'), 3);
  await independent.close();
  assert.deepEqual(log, [2, 1, 3]);
  ${startupRuntimeAssertions}
  ${selectedScopeRuntimeAssertions}
  ${compositionAdapterRuntimeAssertions}
  ${dependencyReferenceRuntimeAssertions}
  ${aliasRuntimeAssertions}
  ${contributionRuntimeAssertions}
  ${observerRuntimeAssertions}
  ${pluginRuntimeAssertions}
  console.log(JSON.stringify({ log, rootDisposed, scopedDisposed, transientsDisposed }));
})().catch(error => { console.error(error); process.exitCode = 1; });`;
for (const emitter of ['classic6', 'native7']) {
  test(`native installed contracts and physical downstream declarations from ${emitter}`, async () => {
    const directory = mkdtempSync(join(tmpdir(), `di-bag-native-package-${emitter}-`));
    const failures: unknown[] = [];
    try {
      const compiler = await resolveNative(root);
      const packageTree = join(directory, 'package'); mkdirSync(packageTree);
      for (const file of ['src', 'package.json', 'tsconfig.json', 'tsconfig.build.json']) cpSync(join(root, file), join(packageTree, file), { recursive: true });
      const built = await supervise(emitter === 'classic6' ? node : compiler.executable,
        [...(emitter === 'classic6' ? [join(root, 'node_modules/typescript/bin/tsc6')] : []), '-p', 'tsconfig.build.json'], packageTree, nativeLimits);
      expect(built).toMatchObject({ status: 0, signal: null, stderr: '' }); expect(built.terminationReason).toBeUndefined();
      const pack = await supervise(node, [npmCli, 'pack', '--ignore-scripts', '--json'], packageTree, nativeLimits);
      expect(pack.status).toBe(0);
      const archive = join(packageTree, JSON.parse(pack.stdout)[0].filename);
      for (const extension of ['cts', 'mts'] as const) {
        const consumer = join(directory, extension); mkdirSync(consumer);
        const installed = await supervise(node, [npmCli, 'install', '--offline', '--ignore-scripts', '--no-audit', '--no-fund', '--no-package-lock', archive,
          join(root, 'tests/fixtures/box-packages/sas-box-0.1.0.tgz'), join(root, 'tests/fixtures/box-packages/val-box-0.1.0.tgz')], consumer, nativeLimits);
        expect(installed.status).toBe(0); expect(installed.terminationReason).toBeUndefined();
        const runtime = join(consumer, `scope-runtime.${extension === 'cts' ? 'cjs' : 'mjs'}`);
        writeFileSync(runtime, scopeRuntimeSource(extension));
        for (const executable of [node, bun]) {
          const executed = await supervise(executable, [runtime], consumer, nativeLimits);
          expect({ emitter, extension, executable, status: executed.status, signal: executed.signal,
            stderr: executed.stderr, stdout: executed.stdout.trim() }).toEqual({
            emitter, extension, executable, status: 0, signal: null, stderr: '',
            stdout: '{"log":[2,1,3],"rootDisposed":1,"scopedDisposed":1,"transientsDisposed":2}',
          });
          expect(executed.terminationReason).toBeUndefined();
        }
        const replacementModuleFeature = join(consumer, 'replacement-module-feature.ts');
        writeFileSync(replacementModuleFeature, readFileSync(join(root, 'tests/types/modules/feature.ts'), 'utf8')
          .replace(/from '(?:\.\.\/)+src'/g, "from 'di-bag'"));
        const support = await compileNative(compiler, consumer, [replacementModuleFeature]);
        expect({ checked: support.checked, diagnostics: support.diagnostics }).toEqual({ checked: true, diagnostics: [] });
        for (const fixture of boxContractFixtures) {
          const file = join(consumer, `consumer.${extension}`), source = boxContractSource(fixture);
          writeFileSync(file, source);
          const result = await compileNative(compiler, consumer, [file]);
          expect({ fixture, checked: result.checked, unparsed: result.unparsed }).toEqual({ fixture, checked: true, unparsed: [] });
          const markers = matchNativeDiagnosticMarkers(source, file, result.diagnostics);
          if (!markers.accepted) failures.push({ emitter, extension, fixture, ...markers });
          expect(result.diagnostics.some(error => error.code === 2589)).toBe(false);
          expect({ fixture, knownNativeRejections: markers.knownNativeRejections }).toEqual({
            fixture,
            knownNativeRejections: replacementNativeGapCounts[fixture] ?? 0,
          });
          if (markers.knownNativeRejections && process.env.DI_BAG_VERBOSE_NATIVE === '1') console.log(JSON.stringify({ emitter, extension, fixture, status: markers.status,
            primaryExpected: markers.primaryExpected, primaryMatched: markers.primaryMatched,
            supplementalExpected: markers.supplementalExpected, supplementalMatched: markers.supplementalMatched,
            knownNativeRejections: markers.knownNativeRejections, gaps: markers.gaps }));
        }
        for (const feature of ['modern-inline', 'token-modules', 'incremental-modules', 'acquisition-mode', 'scopes', 'lifetimes', 'startup', 'selected-scopes', 'composition-adapters', 'dependency-references', 'aliases', 'contributions', 'observers', 'plugins', 'final-adversarial-integration', 'replacement-reflection']) {
          const sourceDir = join(consumer, `${feature}-source`), outputDir = join(consumer, `${feature}-output`);
          mkdirSync(sourceDir); mkdirSync(outputDir);
          const assertions = "type Assert<T extends true> = T; type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;";
          const route = (text: string, nested = false) => text
            .replace(/from '(?:\.\.\/)+\.related-repos\/(sas-box|val-box)\/src'/g, "from '$1'")
            .replace(/from '(?:\.\.\/)+src\/(provider|tokens|token-types|module-types)'/g, `from '${nested ? '..' : '.'}/node_modules/di-bag/dist/$1.js'`)
            .replace(/from '(?:\.\.\/)+src(\/[^']+)?'/g, (_match, subpath: string | undefined) => `from 'di-bag${subpath ?? ''}'`)
            .replace(/import type \{ Assert, Equal \} from '\.\.?\/assert';/, assertions);
          const fixture = feature === 'token-modules' ? 'token-modules/feature.ts' : `${feature}.ts`;
          const producer = join(sourceDir, `feature.${extension}`);
          writeFileSync(producer, route(readFileSync(join(root, 'tests/types', fixture), 'utf8'), true));
          expect(existsSync(producer)).toBe(true);
          if (emitter === 'classic6' && (feature === 'incremental-modules' || feature === 'acquisition-mode' || feature === 'scopes' || feature === 'lifetimes' || feature === 'startup' || feature === 'selected-scopes' || feature === 'composition-adapters' || feature === 'dependency-references' || feature === 'aliases' || feature === 'contributions' || feature === 'observers' || feature === 'plugins' || feature === 'final-adversarial-integration' || feature === 'replacement-reflection')) {
            const program = ts.createProgram([producer], { strict: true, declaration: true, emitDeclarationOnly: true, rootDir: sourceDir, outDir: outputDir,
              noUncheckedIndexedAccess: true, exactOptionalPropertyTypes: true, types: [], target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext });
            const emitted = program.emit();
            expect([...ts.getPreEmitDiagnostics(program), ...emitted.diagnostics].map(error => ts.flattenDiagnosticMessageText(error.messageText, '\n'))).toEqual([]);
          } else {
            const emitted = await compileNative(compiler, consumer, [producer], { noEmit: false, declaration: true, emitDeclarationOnly: true, rootDir: sourceDir, outDir: outputDir });
            expect({ checked: emitted.checked, diagnostics: emitted.diagnostics }).toEqual({ checked: true, diagnostics: [] });
          }
          const declaration = join(outputDir, `feature.d.${extension}`); expect(existsSync(declaration)).toBe(true);
          rmSync(sourceDir, { recursive: true, force: true });
          expect(existsSync(producer)).toBe(false);
          const downstream = join(consumer, `${feature}-consumer.${extension}`);
          const consumerFixture = feature === 'token-modules' ? 'token-modules/consumer.ts' : `${feature}-consumer.ts`;
          const text = route(readFileSync(join(root, 'tests/types', consumerFixture), 'utf8'))
            .replace(/from '\.\/(modern-inline|feature|incremental-modules|acquisition-mode|scopes|lifetimes|startup|selected-scopes|composition-adapters|dependency-references|aliases|contributions|observers|plugins|final-adversarial-integration|replacement-reflection)'/g, `from './${feature}-output/feature.${extension === 'cts' ? 'cjs' : 'mjs'}'`)
            .replace(/import\('\.\/plugins'\)/g, `import('./${feature}-output/feature.${extension === 'cts' ? 'cjs' : 'mjs'}')`);
          writeFileSync(downstream, text);
          const consumed = await compileNative(compiler, consumer, [downstream]);
          expect({ checked: consumed.checked, diagnostics: consumed.diagnostics }).toEqual({ checked: true, diagnostics: [] });
          const classic = ts.createProgram([downstream], { strict: true, noEmit: true, noUncheckedIndexedAccess: true, exactOptionalPropertyTypes: true,
            types: [], target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext });
          expect(classic.getSourceFile(producer)).toBeUndefined(); expect(classic.getSourceFile(declaration)).toBeDefined();
          expect(ts.getPreEmitDiagnostics(classic).map(error => ts.flattenDiagnosticMessageText(error.messageText, '\n'))).toEqual([]);
        }
      }
      expect(failures).toEqual([]);
    } finally { rmSync(directory, { recursive: true, force: true }); }
  }, 120000);
}
