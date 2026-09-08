import { createHash } from 'node:crypto';
import { closeSync, existsSync, fstatSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, readSync, realpathSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { createPublicReleaseEvidence, serializeStable, type ReleaseManifest, type ReleasePackageRecord } from './create-release-manifest.ts';
import { inspectNpmArchive, type NpmArchiveInspection } from './release-archive.ts';
import { RELEASE_COMMAND_LIMITS } from './run-release-command.ts';
import { supervise } from './native-process.ts';

const ARTIFACT_DIRECTORY = '/tmp/di-bag-release-candidate';
const PUBLIC_EVIDENCE = 'docs/reports/2026-09-08-release-candidate-evidence.json';
const PACKAGE_NAMES = ['di-bag', 'sas-box', 'val-box'] as const;
const EXPECTED_RUNTIME = {
  I1: { payloadIdentity: true, metadataIdentity: true, aliasIdentity: true, dispose: ['payload', 'sas'], acquisitions: 1 },
  I2: { nativePromise: true, rootShared: true, transientDistinct: true, childDispose: ['transient-2', 'transient-1', 'scoped'], parentDispose: ['transient-2', 'transient-1', 'scoped', 'root'], acquisitions: 4 },
  I3: { absentIdentity: true, presentUndefined: true, getterIdentity: true, dispose: ['source'], acquisitions: 3 },
  I4: { outputPhase: 'output', errorIdentity: true, startupWrapper: 'DiBagStartupError', startupCauseIdentity: true, dispose: ['plugin', 'sas'], payloadDisposals: 0, acquisitions: 1 },
  I5: { directRetained: true, directDispose: ['direct-1'], startupWrapper: 'DiBagStartupError', startupCauseIdentity: true, startupDispose: ['startup-first'], retryFresh: true },
  I6: { aliasAcquisitions: 0, sharedIdentity: true, unsharedDistinct: true, dispose: ['installation-2', 'installation-1'], acquisitions: 2 },
  I7: { root: 1, scoped: 1, transient: 2, contributions: 2, cleanupFailureIdentity: true, independentCleanupCount: 5 },
  I8: { callbackOrder: ['A:acquisition-ready', 'B:acquisition-ready', 'A:cleanup-completed', 'B:cleanup-completed'], filteredOnEventCalls: 4, aOnErrorCalls: 1, bOnErrorCalls: 0, observerErrorIdentity: true, observerErrorEventIdentity: true, telemetryBlocksClose: false, lateDisposals: 1 },
  I9: { automaticEffects: 0, rawIdentity: true, thenReads: 0, rawDisposals: 1 },
  I10: { syncIdentity: true, rawIdentity: true, syncRawThenReads: 0, asyncThenReads: 1, failureIdentity: true, disposerCalls: 0 },
  I11: { boundaryErrorIdentity: true, retryFresh: true, dispose: ['source', 'source'] },
  I12: { ordinaryWrapper: 'DiBagStartupError', ordinaryCauseIdentity: true, ordinaryCleanupFailures: 0, abortWrapper: 'DiBagStartupCancelledError', abortCauseIdentity: true, timeoutWrapper: 'DiBagStartupCancelledError', timeoutCauseName: 'TimeoutError', dispose: ['late', 'immediate'] },
  I13: { closingEffects: 0, parentDispose: ['child', 'parent'], finalDispose: ['child', 'parent', 'fork'], unsharedDistinct: true },
} as const;
const FORBIDDEN_PATH = /(^|\/)(?:fixtures?|tests?|src|node_modules|scratch)(?:\/|$)|\.tgz$|(^|\/)(?:\.env(?:\.|$)|\.npmrc$)|(?:credentials?|secrets?)/i;
export const VERIFY_RELEASE_USAGE = 'Usage: node scripts/verify-release-artifacts.ts --manifest <absolute-json> --work-dir <absolute-contained-directory>';

export type VerifyReleaseArgs = Readonly<{ manifest: string; workDir: string }>;
export type VerifyReleaseResult = Readonly<{ ok: boolean; failures: readonly string[] }>;

function contained(parent: string, child: string): boolean { const value = relative(parent, child); return value !== '' && !value.startsWith('..') && !isAbsolute(value); }
function exactAbsolute(path: string, label: string): string { if (!isAbsolute(path) || resolve(path) !== path) throw new Error(`${label} must be absolute and canonical`); return path; }
export function parseVerifyReleaseArgs(argv: readonly string[]): VerifyReleaseArgs | Readonly<{ help: true }> {
  if (argv.length === 1 && argv[0] === '--help') return Object.freeze({ help: true as const });
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) {
    const option = argv[index], value = argv[index + 1];
    if (!['--manifest', '--work-dir'].includes(option ?? '')) throw new Error(`unsupported option or positional argument: ${option}`);
    if (!value || values.has(option!)) throw new Error(`missing or duplicate value for ${option}`); values.set(option!, value);
  }
  const artifact = realpathSync(ARTIFACT_DIRECTORY);
  const manifest = exactAbsolute(values.get('--manifest') ?? '', 'manifest');
  if (!contained(artifact, manifest) || realpathSync(manifest) !== manifest || !lstatSync(manifest).isFile()) throw new Error('manifest must be a contained canonical regular file');
  const workDir = exactAbsolute(values.get('--work-dir') ?? '', 'work directory');
  if (!contained(artifact, workDir) || workDir === manifest) throw new Error('work directory must be contained and distinct from manifest');
  const parent = realpathSync(dirname(workDir)); if (parent !== dirname(workDir)) throw new Error('work directory parent must be canonical');
  if (existsSync(workDir)) {
    if (!lstatSync(workDir).isDirectory() || realpathSync(workDir) !== workDir) throw new Error('work directory must be a canonical directory');
    if (readdirSync(workDir).length) throw new Error('work directory must be empty');
  }
  return Object.freeze({ manifest, workDir });
}

function readRegularOnce(path: string, expectedContainer?: string): Uint8Array {
  if (!isAbsolute(path) || resolve(path) !== path) throw new Error(`noncanonical file path: ${path}`);
  if (expectedContainer && !contained(expectedContainer, path)) throw new Error(`file is outside expected container: ${path}`);
  const descriptor = openSync(path, 'r');
  try {
    const opened = realpathSync(`/proc/self/fd/${descriptor}`);
    if (opened !== path || expectedContainer && !contained(expectedContainer, opened)) throw new Error(`file descriptor escaped expected path: ${path}`);
    const before = fstatSync(descriptor); if (!before.isFile()) throw new Error(`not a regular file: ${path}`);
    const bytes = new Uint8Array(before.size); let offset = 0;
    while (offset < bytes.length) { const count = readSync(descriptor, bytes, offset, bytes.length - offset, offset); if (!count) throw new Error(`short read: ${path}`); offset += count; }
    const after = fstatSync(descriptor); if (before.dev !== after.dev || before.ino !== after.ino || before.size !== after.size || before.mtimeMs !== after.mtimeMs) throw new Error(`file changed while reading: ${path}`);
    return bytes;
  } finally { closeSync(descriptor); }
}
const hash = (algorithm: string, bytes: Uint8Array, encoding: 'hex' | 'base64' = 'hex') => createHash(algorithm).update(bytes).digest(encoding);
function stable(value: unknown): unknown { if (Array.isArray(value)) return value.map(stable); if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, stable(item)])); return value; }
const same = (left: unknown, right: unknown) => JSON.stringify(stable(left)) === JSON.stringify(stable(right));

function normalizedMetadata(raw: any): ReleasePackageRecord['packageMetadata'] {
  const map = (value: unknown) => Object.freeze(value && typeof value === 'object' && !Array.isArray(value) ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))) : {});
  return Object.freeze({ name: raw.name, version: raw.version, ...(typeof raw.main === 'string' ? { main: raw.main } : {}), ...(typeof raw.types === 'string' ? { types: raw.types } : {}),
    files: Object.freeze(Array.isArray(raw.files) ? [...raw.files].sort() : []), exports: stable(raw.exports ?? null), dependencies: map(raw.dependencies) as Record<string, string>,
    peerDependencies: map(raw.peerDependencies) as Record<string, string>, optionalDependencies: map(raw.optionalDependencies) as Record<string, string>,
    bundledDependencies: Object.freeze(Array.isArray(raw.bundledDependencies) ? [...raw.bundledDependencies].sort() : []) });
}
function packFailures(record: ReleasePackageRecord, inspection: NpmArchiveInspection, bytes: Uint8Array): string[] {
  const failures: string[] = [], files = inspection.entries.map(entry => entry.path.slice('package/'.length)).sort();
  const expected = { id: `${record.name}@${record.version}`, name: record.name, version: record.version, filename: `${record.name}-${record.version}.tgz`, size: bytes.byteLength,
    unpackedSize: inspection.unpackedBytes, shasum: hash('sha1', bytes), integrity: `sha512-${hash('sha512', bytes, 'base64')}` };
  for (const [label, raw] of [['dry-run', record.pack?.dryRunJson], ['actual', record.pack?.packJson]] as const) {
    if (!Array.isArray(raw) || raw.length !== 1 || !raw[0] || typeof raw[0] !== 'object') { failures.push(`${record.name} ${label} pack JSON must contain exactly one result`); continue; }
    const result: any = raw[0];
    const expectedKeys = ['bundled', 'entryCount', 'filename', 'files', 'id', 'integrity', 'name', 'shasum', 'size', 'unpackedSize', 'version'];
    if (!same(Object.keys(result).sort(), expectedKeys)) failures.push(`${record.name} ${label} pack fields mismatch`);
    for (const [field, value] of Object.entries(expected)) if (result[field] !== value) failures.push(`${record.name} ${label} pack ${field} mismatch`);
    const actualFiles = Array.isArray(result.files) ? result.files.map((file: any) => ({ path: file?.path, size: file?.size, mode: file?.mode })).sort((a: any, b: any) => String(a.path).localeCompare(String(b.path))) : [];
    if (Array.isArray(result.files) && result.files.some((file: any) => !file || !same(Object.keys(file).sort(), ['mode', 'path', 'size']))) failures.push(`${record.name} ${label} pack file fields mismatch`);
    const expectedFiles = inspection.entries.map(entry => ({ path: entry.path.slice('package/'.length), size: entry.bytes, mode: entry.mode }));
    if (result.entryCount !== files.length || new Set(actualFiles.map((file: any) => file.path)).size !== files.length || !same(actualFiles, expectedFiles)) failures.push(`${record.name} ${label} pack file inventory mismatch`);
    if (!Array.isArray(result.bundled) || result.bundled.length) failures.push(`${record.name} ${label} pack bundled list mismatch`);
  }
  return failures;
}
function contentFailures(record: ReleasePackageRecord, inspection: NpmArchiveInspection): string[] {
  const failures: string[] = [], files = inspection.entries.map(entry => entry.path.slice('package/'.length)).sort();
  for (const required of ['LICENSE', 'README.md', 'package.json']) if (!files.includes(required)) failures.push(`${record.name} missing ${required}`);
  for (const file of files) if (!['LICENSE', 'README.md', 'package.json'].includes(file) && !file.startsWith('dist/') || FORBIDDEN_PATH.test(file) || /^dist\/(?:adapters?|internal)\//.test(file)) failures.push(`${record.name} forbidden package file: ${file}`);
  if (record.packageMetadata.main !== './dist/index.js' || record.packageMetadata.types !== './dist/index.d.ts') failures.push(`${record.name} main/types metadata mismatch`);
  if (record.name === 'sas-box') {
    const expected = ['LICENSE', 'README.md', 'dist/index.d.ts', 'dist/index.js', 'package.json']; if (!same(files, expected)) failures.push('sas-box package must contain exactly five approved entries');
  } else if (record.name === 'val-box') {
    const expected = ['LICENSE', 'README.md', 'dist/index.d.ts', 'dist/index.js', 'dist/snapshot.d.ts', 'dist/snapshot.js', 'package.json']; if (!same(files, expected)) failures.push('val-box package must contain exactly seven approved entries');
  } else {
    if (!same(record.packageMetadata.files, ['dist'])) failures.push("di-bag package metadata files must equal ['dist']");
    for (const name of ['index', 'node', 'sas-box', 'val-box']) for (const extension of ['d.ts', 'js']) if (!files.includes(`dist/${name}.${extension}`)) failures.push(`di-bag missing public export file dist/${name}.${extension}`);
    const expectedExports = { './node': { types: './dist/node.d.ts', default: './dist/node.js' }, '.': { types: './dist/index.d.ts', default: './dist/index.js' }, './sas-box': { types: './dist/sas-box.d.ts', default: './dist/sas-box.js' }, './val-box': { types: './dist/val-box.d.ts', default: './dist/val-box.js' } };
    if (!same(record.packageMetadata.exports, expectedExports)) failures.push('di-bag public exports mismatch');
    for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies'] as const) if (Object.keys(record.packageMetadata[field]).length) failures.push(`di-bag ${field} must be empty`);
    if (record.packageMetadata.bundledDependencies.length) failures.push('di-bag bundledDependencies must be empty');
  }
  if (record.name !== 'di-bag') {
    if (!same(record.packageMetadata.files, ['dist'])) failures.push(`${record.name} package metadata files must equal ['dist']`);
    if (!same(record.packageMetadata.exports, { '.': { types: './dist/index.d.ts', default: './dist/index.js' } })) failures.push(`${record.name} public exports mismatch`);
    for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies'] as const) if (Object.keys(record.packageMetadata[field]).length) failures.push(`${record.name} ${field} must be empty`);
    if (record.packageMetadata.bundledDependencies.length) failures.push(`${record.name} bundledDependencies must be empty`);
  }
  return failures;
}

function validateManifestShape(value: any): asserts value is ReleaseManifest {
  if (!value || value.schemaVersion !== 1 || value.artifactDirectory !== ARTIFACT_DIRECTORY || !Array.isArray(value.packages) || value.packages.length !== 3) throw new Error('invalid release manifest schema');
  if (new Set(value.packages.map((item: any) => item?.name)).size !== 3 || PACKAGE_NAMES.some(name => !value.packages.some((item: any) => item?.name === name))) throw new Error('release manifest package set mismatch');
}
type VerifiedArchive = Readonly<{ inspection: NpmArchiveInspection; bytes: Uint8Array; version: string }>;
export function verifyReleaseManifestStatic(manifest: ReleaseManifest): Readonly<{ failures: readonly string[]; archives: ReadonlyMap<string, VerifiedArchive> }> {
  const failures: string[] = [], archives = new Map<string, VerifiedArchive>();
  for (const record of manifest.packages) {
    try {
      const bytes = readRegularOnce(record.archive, ARTIFACT_DIRECTORY);
      if (record.bytes !== bytes.byteLength) failures.push(`${record.name} archive byte count mismatch`);
      if (record.sha256 !== hash('sha256', bytes)) failures.push(`${record.name} SHA-256 mismatch`);
      if (record.sha512 !== hash('sha512', bytes)) failures.push(`${record.name} SHA-512 mismatch`);
      if (record.integrity !== `sha512-${hash('sha512', bytes, 'base64')}`) failures.push(`${record.name} integrity mismatch`);
      let inspection: NpmArchiveInspection;
      try { inspection = inspectNpmArchive(bytes); } catch (error) { failures.push(`${record.name} unsafe or malformed archive: ${String(error)}`); continue; }
      archives.set(record.name, Object.freeze({ inspection, bytes, version: record.version }));
      const files = inspection.entries.map(entry => entry.path.slice('package/'.length)).sort();
      if (!same(record.files, files)) failures.push(`${record.name} manifest file list mismatch`);
      let metadata: any; try { metadata = JSON.parse(new TextDecoder().decode(inspection.packageJson)); } catch { failures.push(`${record.name} package.json is invalid JSON`); continue; }
      if (!same(record.packageMetadata, normalizedMetadata(metadata))) failures.push(`${record.name} package metadata mismatch`);
      failures.push(...packFailures(record, inspection, bytes), ...contentFailures(record, inspection));
    } catch (error) { failures.push(`${record.name} archive read failed: ${String(error)}`); }
  }
  try {
    const diBag = manifest.packages.find(record => record.name === 'di-bag')!;
    if (realpathSync(diBag.checkout.path) !== diBag.checkout.path) throw new Error('DI Bag checkout is not canonical');
    const publicPath = resolve(diBag.checkout.path, PUBLIC_EVIDENCE), bytes = readRegularOnce(publicPath, diBag.checkout.path);
    const expected = new TextEncoder().encode(serializeStable(createPublicReleaseEvidence(manifest)));
    if (bytes.byteLength !== expected.byteLength || hash('sha256', bytes) !== hash('sha256', expected)) failures.push('sanitized public evidence is missing, stale, malformed, or has extra fields');
  } catch (error) { failures.push(`sanitized public evidence validation failed: ${String(error)}`); }
  return Object.freeze({ failures: Object.freeze(failures), archives });
}

function materializeVerifiedArchives(archives: ReadonlyMap<string, VerifiedArchive>, root: string): Readonly<Record<string, string>> {
  const extraction = resolve(root, 'extracted'), owned = resolve(root, 'archives'); mkdirSync(extraction, { recursive: true }); mkdirSync(owned);
  const paths: Record<string, string> = {};
  for (const [name, verified] of archives) {
    const archivePath = resolve(owned, `${name}-${verified.version}.tgz`); writeFileSync(archivePath, verified.bytes, { flag: 'wx' });
    const reread = readRegularOnce(archivePath, root); if (hash('sha256', reread) !== hash('sha256', verified.bytes)) throw new Error('owned archive copy mismatch'); paths[name] = archivePath;
    for (const entry of verified.inspection.entries) {
    const relativePath = entry.path.slice('package/'.length), target = resolve(extraction, name, relativePath), packageRoot = resolve(extraction, name);
    if (!contained(packageRoot, target)) throw new Error('validated archive path escaped during extraction');
    mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, entry.content, { flag: 'wx' });
    }
  }
  return Object.freeze(paths);
}
async function runChecked(argv: readonly string[], cwd: string): Promise<string> {
  const result = await supervise(argv[0]!, argv.slice(1), cwd, RELEASE_COMMAND_LIMITS);
  if (result.status !== 0 || result.signal !== null || result.terminationReason !== undefined || result.stderr !== '') throw new Error(`command failed: ${JSON.stringify({ argv, status: result.status, signal: result.signal, terminationReason: result.terminationReason, stderr: result.stderr })}`);
  return result.stdout;
}
function writeConsumerManifest(directory: string): void { mkdirSync(directory, { recursive: true }); writeFileSync(resolve(directory, 'package.json'), `${JSON.stringify({ private: true })}\n`, { flag: 'wx' }); }
async function installOffline(directory: string, archives: readonly string[]): Promise<void> {
  await runChecked(releaseInstallArgv(archives), directory);
}
export function releaseInstallArgv(archives: readonly string[]): readonly string[] {
  return Object.freeze(['npm', 'install', '--offline', '--ignore-scripts', '--no-audit', '--no-fund', '--no-package-lock', ...archives]);
}
export function traceInstalledRoot(entry: string): Readonly<{ files: readonly string[]; bareImports: readonly string[]; unresolved: readonly string[] }> {
  const pending = [entry], files = new Set<string>(), bare = new Set<string>(), unresolved = new Set<string>();
  while (pending.length) {
    const file = pending.pop()!; if (files.has(file)) continue; files.add(file);
    const syntax = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS), specifiers: string[] = [];
    const visit = (node: ts.Node): void => { if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) specifiers.push(node.moduleSpecifier.text); if (ts.isCallExpression(node) && node.arguments[0] && ts.isStringLiteral(node.arguments[0]) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || ts.isIdentifier(node.expression) && node.expression.text === 'require')) specifiers.push(node.arguments[0].text); ts.forEachChild(node, visit); }; visit(syntax);
    for (const specifier of specifiers) {
      if (!specifier.startsWith('.')) { bare.add(specifier); continue; }
      const base = resolve(dirname(file), specifier), target = [base, `${base}.js`, join(base, 'index.js')].find(existsSync);
      if (target) pending.push(target); else unresolved.add(`${file}:${specifier}`);
    }
  }
  return Object.freeze({ files: Object.freeze([...files].sort()), bareImports: Object.freeze([...bare].sort()), unresolved: Object.freeze([...unresolved].sort()) });
}
async function verifyRuntimeConsumers(manifest: ReleaseManifest, workDir: string, archives: Readonly<Record<string, string>>): Promise<void> {
  const full = resolve(workDir, 'full-consumer'), core = resolve(workDir, 'core-consumer'); writeConsumerManifest(full); writeConsumerManifest(core);
  const diBagArchive = archives['di-bag'], sasBoxArchive = archives['sas-box'], valBoxArchive = archives['val-box'];
  if (!diBagArchive || !sasBoxArchive || !valBoxArchive) throw new Error('verified archive set is incomplete');
  await installOffline(full, [diBagArchive, sasBoxArchive, valBoxArchive]); await installOffline(core, [diBagArchive]);
  for (const box of ['sas-box', 'val-box']) if (existsSync(resolve(core, 'node_modules', box))) throw new Error(`unexpected ${box} in core-only consumer`);
  const packageRoot = resolve(core, 'node_modules/di-bag'), distRoot = resolve(packageRoot, 'dist'), traced = traceInstalledRoot(resolve(distRoot, 'index.js'));
  if (traced.unresolved.length || traced.bareImports.length || traced.files.some(file => !contained(distRoot, file) || /\/(?:node|sas-box|val-box)\.js$/.test(file))) throw new Error(`core-only import graph is not isolated: ${JSON.stringify(traced)}`);
  for (const mode of ['commonjs', 'module'] as const) {
    const corePath = resolve(core, `core.${mode === 'commonjs' ? 'cjs' : 'mjs'}`), load = mode === 'commonjs'
      ? `const Module=require('node:module');const old=Module._load;Module._load=function(name,...args){if(name.startsWith('node:'))throw new Error('core imported Node');return old.call(this,name,...args)};const {DiBag}=require('di-bag');`
      : `import Module,{createRequire}from'node:module';const old=Module._load;Module._load=function(name,...args){if(name.startsWith('node:'))throw new Error('core imported Node');return old.call(this,name,...args)};const {DiBag}=await import('di-bag');`;
    writeFileSync(corePath, `${load}(async()=>{const bag=DiBag.begin().add({answer:DiBag.factory(()=>42,{acquisition:'raw'})}).end();console.log(bag.resolve('answer'));await bag.close()})().catch(e=>{console.error(e);process.exitCode=1});`);
    for (const executable of ['node', 'bun']) { const output = await runChecked([executable, corePath], core); if (output.trim() !== '42') throw new Error(`core-only ${mode} ${executable} output mismatch: ${JSON.stringify(output)}`); }
    const fullPath = resolve(full, `oracle.${mode === 'commonjs' ? 'cjs' : 'mjs'}`);
    const checkout = manifest.packages.find(record => record.name === 'di-bag')!.checkout.path;
    const runtimeFixture = resolve(checkout, 'tests/final-adversarial-runtime-fixture.ts');
    const source = await runChecked(['bun', '-e', `const m=await import(${JSON.stringify(pathToFileURL(runtimeFixture).href)});process.stdout.write(m.finalAdversarialPackageRuntimeSource(${JSON.stringify(mode)}))`], full);
    writeFileSync(fullPath, source);
    for (const executable of ['node', 'bun']) {
      const output = await runChecked([executable, fullPath], full); let parsed: unknown; try { parsed = JSON.parse(output.trim()); } catch { throw new Error(`I1-I15 ${mode} ${executable} emitted invalid JSON`); }
      const runtimeEntries = Object.fromEntries(Object.entries(parsed as Record<string, unknown>).filter(([key]) => /^I(?:[1-9]|1[0-3])$/.test(key)));
      if (!same(runtimeEntries, EXPECTED_RUNTIME)) throw new Error(`I1-I13 ${mode} ${executable} oracle mismatch`);
    }
  }
  await verifyDeclarations(full, manifest.packages.find(record => record.name === 'di-bag')!.checkout.path);
}
async function verifyDeclarations(consumer: string, checkout: string): Promise<void> {
  const source = `import {DiBag,type ProviderOutput,type ProviderTokenNeeds,type ProviderAcquisitionMetadata,type ValBoxFrame}from'di-bag';import{fromSasBox}from'di-bag/sas-box';import{fromValBox}from'di-bag/val-box';import{SasBox}from'sas-box';import{ValBox}from'val-box';export const key=Symbol('release');export const token=DiBag.token(key).of<number>();export const boxed=fromValBox(fromSasBox(DiBag.fromTokens([token],value=>SasBox.fromValue(new ValBox.WithValue.WithMetadata({boxed:true as const,value},{origin:'release' as const},'release'))),{mode:'sync'}));export type Contract=[ProviderOutput<typeof boxed>,ProviderTokenNeeds<typeof boxed>,ProviderAcquisitionMetadata<typeof boxed>,ValBoxFrame<{origin:'release'}>];`;
  for (const [emitter, emitCompiler] of [['classic6', resolve(checkout, 'node_modules/.bin/tsc6')], ['native7', resolve(checkout, 'node_modules/.bin/tsc')]] as const) for (const format of ['cts', 'mts'] as const) {
    const runtimeExtension = format === 'cts' ? 'cjs' : 'mjs', directory = resolve(consumer, `declarations-${emitter}-${format}`), out = resolve(directory, 'out'); mkdirSync(directory); const producer = resolve(directory, `producer.${format}`); writeFileSync(producer, source);
    writeFileSync(resolve(directory, 'tsconfig.json'), JSON.stringify({ compilerOptions: { strict: true, declaration: true, emitDeclarationOnly: true, skipLibCheck: false, noUncheckedIndexedAccess: true, exactOptionalPropertyTypes: true, module: 'NodeNext', moduleResolution: 'NodeNext', target: 'ES2022', rootDir: directory, outDir: out, types: [] }, files: [`producer.${format}`] }));
    await runChecked([emitCompiler, '-p', resolve(directory, 'tsconfig.json')], directory); unlinkSync(producer);
    const assertion = `import{boxed,token}from'./producer.${runtimeExtension}';import type{ProviderOutput,ProviderTokenNeeds}from'di-bag';type A<T extends true>=T;type E<X,Y>=(<T>()=>T extends X?1:2)extends(<T>()=>T extends Y?1:2)?true:false;export type Contract=[A<E<ProviderOutput<typeof boxed>,{boxed:true;value:number}>>,A<E<ProviderTokenNeeds<typeof boxed>,typeof token>>];`;
    const negative = `import{boxed}from'./producer.${runtimeExtension}';import type{ProviderOutput}from'di-bag';// diagnostic: Type 'string' is not assignable to type 'number'\nconst wrongValue:ProviderOutput<typeof boxed>={boxed:true,value:'wrong'};// diagnostic: Type 'false' is not assignable to type 'true'\nconst wrongTag:ProviderOutput<typeof boxed>={boxed:false,value:1};`;
    writeFileSync(resolve(out, `consumer.${format}`), assertion); writeFileSync(resolve(out, `negative.${format}`), negative);
    for (const [downstream, compiler] of [['classic6', resolve(checkout, 'node_modules/.bin/tsc6')], ['native7', resolve(checkout, 'node_modules/.bin/tsc')]] as const) {
      const positiveConfig = resolve(out, `tsconfig.${downstream}.json`); writeFileSync(positiveConfig, JSON.stringify({ compilerOptions: { strict: true, noEmit: true, skipLibCheck: false, noUncheckedIndexedAccess: true, exactOptionalPropertyTypes: true, module: 'NodeNext', moduleResolution: 'NodeNext', target: 'ES2022', types: [] }, files: [`consumer.${format}`] }));
      await runChecked([compiler, '-p', positiveConfig], out);
      const negativeConfig = resolve(out, `tsconfig.${downstream}.negative.json`); writeFileSync(negativeConfig, JSON.stringify({ compilerOptions: { strict: true, noEmit: true, skipLibCheck: false, noUncheckedIndexedAccess: true, exactOptionalPropertyTypes: true, module: 'NodeNext', moduleResolution: 'NodeNext', target: 'ES2022', types: [] }, files: [`negative.${format}`] }));
      const result = await supervise(compiler, ['-p', negativeConfig], out, RELEASE_COMMAND_LIMITS), output = `${result.stdout}\n${result.stderr}`;
      if (result.status === 0 || result.signal !== null || result.terminationReason !== undefined || (output.match(/error TS\d+:/g) ?? []).length !== 2 || output.includes('TS2589') || !output.includes("Type 'string' is not assignable to type 'number'") || !output.includes("Type 'false' is not assignable to type 'true'")) throw new Error(`I14 negative declaration evidence mismatch for ${emitter}/${format}/${downstream}: ${output}`);
    }
  }
}

export async function verifyReleaseArtifacts(manifestPath: string, workDir: string): Promise<VerifyReleaseResult> {
  const failures: string[] = []; let manifest: ReleaseManifest;
  try {
    exactAbsolute(manifestPath, 'manifest'); exactAbsolute(workDir, 'work directory');
    if (!contained(realpathSync(ARTIFACT_DIRECTORY), manifestPath) || realpathSync(manifestPath) !== manifestPath || !lstatSync(manifestPath).isFile()) throw new Error('manifest must be a contained canonical regular file');
    if (!contained(realpathSync(ARTIFACT_DIRECTORY), workDir) || workDir === manifestPath || realpathSync(dirname(workDir)) !== dirname(workDir)) throw new Error('work directory must be contained with a canonical parent');
    if (existsSync(workDir) && (!lstatSync(workDir).isDirectory() || realpathSync(workDir) !== workDir || readdirSync(workDir).length)) throw new Error('work directory must be an empty canonical directory');
    const bytes = readRegularOnce(manifestPath, ARTIFACT_DIRECTORY); manifest = JSON.parse(new TextDecoder().decode(bytes)); validateManifestShape(manifest);
  }
  catch (error) { return Object.freeze({ ok: false, failures: Object.freeze([`manifest validation failed: ${String(error)}`]) }); }
  const checked = verifyReleaseManifestStatic(manifest); failures.push(...checked.failures);
  if (failures.length) return Object.freeze({ ok: false, failures: Object.freeze(failures) });
  try {
    if (existsSync(workDir) && readdirSync(workDir).length) throw new Error('work directory must be empty');
    mkdirSync(workDir, { recursive: true }); const owned = materializeVerifiedArchives(checked.archives, workDir); await verifyRuntimeConsumers(manifest, workDir, owned);
  } catch (error) { failures.push(`offline consumer verification failed: ${String(error)}`); }
  return Object.freeze({ ok: failures.length === 0, failures: Object.freeze(failures) });
}

if (basename(process.argv[1] ?? '') === 'verify-release-artifacts.ts') {
  try {
    const args = parseVerifyReleaseArgs(process.argv.slice(2));
    if ('help' in args) console.log(VERIFY_RELEASE_USAGE);
    else verifyReleaseArtifacts(args.manifest, args.workDir).then(result => { console.log(JSON.stringify(result)); if (!result.ok) process.exitCode = 1; });
  } catch (error) { console.error(error); process.exitCode = 1; }
}
