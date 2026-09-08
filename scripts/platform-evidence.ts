import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, lstatSync, mkdtempSync, mkdirSync, readdirSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gunzipSync, gzipSync } from 'node:zlib';

export type PlatformTool = 'node' | 'npm' | 'classic6' | 'bun' | 'deno' | 'esbuild' | 'playwright' | 'chromium';
export type ToolUnavailableReason = 'not-provisioned' | 'version-mismatch' | 'hash-mismatch';
export type ToolPin =
  | { status: 'pinned'; argv: readonly [string, ...string[]]; versionArgv: readonly [string, ...string[]]; version: string; versionText: string; sha256: string }
  | { status: 'unavailable'; reason: ToolUnavailableReason };
export type PlatformVersions = { schema: 1 } & Record<PlatformTool, ToolPin>;
export type VerifiedTool = Extract<ToolPin, { status: 'pinned' }> & { name: PlatformTool; hashPath: string };

export type PlatformEnvironment = {
  status: number | null;
  signal: string | null;
  stdout: string;
  stderr: string;
};
export type PlatformAssertion = { status: 'pass' } | { status: 'fail'; reason: string };
export type PlatformRow = {
  schema: 1;
  lane: string;
  status: 'pass' | 'fail' | 'unavailable';
  utc: string;
  git: { sha: string; dirty: boolean };
  reason?: string;
  [key: string]: unknown;
};

type PackFile = { path: string; size?: number };
type PackResult = { filename: string; files: PackFile[]; name?: string; version?: string };
export type PackedArchive = {
  path: string;
  sha256: string;
  packageTree: string;
  files: readonly string[];
};

export type BrowserBundle = {
  path: string;
  sha256: string;
  bytes: number;
  gzipBytes: number;
  gzipSha256: string;
  metafilePath: string;
  metafileSha256: string;
  resolvedDiBag: string;
};

export type BrowserWorkerTranscript = {
  messages: readonly unknown[];
  errors: readonly string[];
  console: readonly string[];
  timedOut: boolean;
};

export type BrowserWorkerDriver = (
  bundleBytes: Uint8Array,
  chromium: VerifiedTool,
  signal: AbortSignal,
) => Promise<BrowserWorkerTranscript>;

function sha256File(path: string): string {
  return createHash('sha256').update(Uint8Array.from(readFileSync(path))).digest('hex');
}

function sha256Bytes(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function isStringTuple(value: unknown): value is [string, ...string[]] {
  return Array.isArray(value) && value.length > 0 && value.every(item => typeof item === 'string' && item.length > 0);
}

function readManifest(root: string): PlatformVersions {
  const path = join(root, 'tools', 'platform-versions.json');
  const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
  if (!parsed || typeof parsed !== 'object' || (parsed as { schema?: unknown }).schema !== 1) {
    throw new Error('platform tool manifest must have schema 1');
  }
  return parsed as PlatformVersions;
}

function assertPin(name: PlatformTool, value: unknown): ToolPin {
  if (!value || typeof value !== 'object') throw new Error(`platform tool ${name} has no manifest entry`);
  const pin = value as Partial<ToolPin>;
  if (pin.status === 'unavailable') {
    if (!['not-provisioned', 'version-mismatch', 'hash-mismatch'].includes(String(pin.reason))) {
      throw new Error(`platform tool ${name} has an invalid unavailable reason`);
    }
    return pin as ToolPin;
  }
  if (pin.status !== 'pinned' || !isStringTuple(pin.argv) || !isStringTuple(pin.versionArgv)
    || typeof pin.version !== 'string' || !pin.version
    || typeof pin.versionText !== 'string' || !pin.versionText
    || typeof pin.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(pin.sha256)) {
    throw new Error(`platform tool ${name} has incomplete pinned identity`);
  }
  if (!pin.argv.every(isAbsolute) || !pin.versionArgv[0] || !isAbsolute(pin.versionArgv[0])) {
    throw new Error(`platform tool ${name} argv must use absolute paths`);
  }
  const versionArgv = pin.versionArgv;
  if (pin.argv.some((part, index) => versionArgv[index] !== part)) {
    throw new Error(`platform tool ${name} version argv must extend invocation argv`);
  }
  return pin as ToolPin;
}

function invokedArtifact(pin: Extract<ToolPin, { status: 'pinned' }>): string {
  // Script-backed tools are invoked through pinned Node; the script is the tool artifact.
  return pin.argv[1] ?? pin.argv[0];
}

export async function verifyTool(root: string, name: PlatformTool): Promise<VerifiedTool | { status: 'unavailable'; reason: ToolUnavailableReason }> {
  const pin = assertPin(name, readManifest(root)[name]);
  if (pin.status === 'unavailable') return pin;
  const hashPath = invokedArtifact(pin);
  try {
    if (!existsSync(pin.argv[0]) || !statSync(pin.argv[0]).isFile()
      || !existsSync(hashPath) || !statSync(hashPath).isFile()) return { status: 'unavailable', reason: 'not-provisioned' };
    if (sha256File(hashPath) !== pin.sha256) return { status: 'unavailable', reason: 'hash-mismatch' };
    const probe = spawnSync(pin.versionArgv[0], pin.versionArgv.slice(1), { cwd: root, encoding: 'utf8', maxBuffer: 1024 * 1024 });
    if (probe.error || probe.status !== 0 || probe.signal !== null || probe.stderr !== '' || probe.stdout !== pin.versionText) {
      return { status: 'unavailable', reason: 'version-mismatch' };
    }
  } catch {
    return { status: 'unavailable', reason: 'not-provisioned' };
  }
  return { ...pin, name, hashPath };
}

export function stableJson(value: unknown): string {
  const seen = new Set<object>();
  const normalize = (item: unknown): unknown => {
    if (Array.isArray(item)) return item.map(normalize);
    if (item && typeof item === 'object') {
      if (seen.has(item)) throw new TypeError('cannot serialize circular platform evidence');
      seen.add(item);
      const sorted: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
      for (const key of Object.keys(item).sort()) sorted[key] = normalize((item as Record<string, unknown>)[key]);
      seen.delete(item);
      return sorted;
    }
    return item;
  };
  return JSON.stringify(normalize(value));
}

export function evaluatePlatformChild(expected: { lane: string; [key: string]: unknown }, supervised: PlatformEnvironment): PlatformAssertion {
  if (supervised.signal !== null) return { status: 'fail', reason: `child terminated by ${supervised.signal}` };
  if (supervised.status !== 0) return { status: 'fail', reason: `child exited with status ${String(supervised.status)}` };
  if (supervised.stderr !== '') return { status: 'fail', reason: 'child stderr is not empty' };
  let actual: unknown;
  try { actual = JSON.parse(supervised.stdout); }
  catch { return { status: 'fail', reason: 'child stdout is not one canonical JSON object' }; }
  if (!actual || typeof actual !== 'object' || Array.isArray(actual)
    || supervised.stdout !== `${stableJson(actual)}\n`) {
    return { status: 'fail', reason: 'child stdout is not one canonical JSON object' };
  }
  if ((actual as { lane?: unknown }).lane !== expected.lane) return { status: 'fail', reason: 'child lane mismatch' };
  if (stableJson(actual) !== stableJson(expected)) return { status: 'fail', reason: 'child result mismatch' };
  return { status: 'pass' };
}

function runExact(tool: VerifiedTool, args: readonly string[], cwd: string): PlatformEnvironment {
  const command = tool.argv[0];
  const result = spawnSync(command, [...tool.argv.slice(1), ...args], { cwd, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  if (result.error) throw result.error;
  return { status: result.status, signal: result.signal, stdout: result.stdout, stderr: result.stderr };
}

const platformRoot = resolve(__dirname, '..');
const expectedPortableResult = {
  aliasCanonical: true,
  cleanupLog: ['scoped', 'transient-2', 'transient-1', 'root'],
  inspectionFrozen: true,
  metadataFrozen: true,
  rawDisposerIdentity: true,
  rawPromiseIdentity: true,
  rootOnce: true,
  scopedOnce: true,
  transientDistinct: true,
} as const;

function platformGit(): PlatformRow['git'] {
  const sha = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: platformRoot, encoding: 'utf8' });
  const dirty = spawnSync('git', ['status', '--porcelain'], { cwd: platformRoot, encoding: 'utf8' });
  if (sha.status !== 0 || sha.signal !== null || !/^[a-f0-9]{40}\n$/.test(sha.stdout)
    || dirty.status !== 0 || dirty.signal !== null) {
    throw new Error('cannot establish platform evidence Git identity');
  }
  return { sha: sha.stdout.trim(), dirty: dirty.stdout !== '' };
}

function denoRow(status: PlatformRow['status'], fields: Record<string, unknown> = {}): PlatformRow {
  return { schema: 1, lane: 'deno-root', status, utc: new Date().toISOString(), git: platformGit(), ...fields };
}

function browserRow(status: PlatformRow['status'], fields: Record<string, unknown> = {}): PlatformRow {
  return { schema: 1, lane: 'browser-worker-minified', status, utc: new Date().toISOString(), git: platformGit(), ...fields };
}

type MetafileImport = { path?: unknown; external?: unknown };
type MetafileInput = { imports?: unknown };
type EsbuildMetafile = { inputs: Record<string, MetafileInput>; outputs: Record<string, unknown> };

function parseMetafile(value: unknown): EsbuildMetafile {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid esbuild metafile');
  const candidate = value as { inputs?: unknown; outputs?: unknown };
  if (!candidate.inputs || typeof candidate.inputs !== 'object' || Array.isArray(candidate.inputs)
    || !candidate.outputs || typeof candidate.outputs !== 'object' || Array.isArray(candidate.outputs)) {
    throw new Error('invalid esbuild metafile');
  }
  return candidate as EsbuildMetafile;
}

function pathInside(path: string, directory: string): boolean {
  return path.startsWith(`${directory}${sep}`);
}

export function assertBrowserMetafile(value: unknown, consumer: string): string {
  const metafile = parseMetafile(value);
  const consumerRoot = realpathSync(consumer);
  const modulesRoot = join(consumerRoot, 'node_modules');
  const packageRoot = realpathSync(join(modulesRoot, 'di-bag'));
  const expectedRoot = realpathSync(join(packageRoot, 'dist', 'index.js'));
  let rootEntries = 0;

  const rejectNodeImports = (record: Record<string, unknown>) => {
    for (const detail of Object.values(record)) {
      if (!detail || typeof detail !== 'object' || Array.isArray(detail)) throw new Error('invalid esbuild metafile');
      const imports = (detail as { imports?: unknown }).imports ?? [];
      if (!Array.isArray(imports)) throw new Error('invalid esbuild metafile');
      for (const imported of imports as MetafileImport[]) {
        if (!imported || typeof imported !== 'object' || typeof imported.path !== 'string') throw new Error('invalid esbuild metafile');
        if (imported.path.startsWith('node:')) throw new Error('browser bundle contains a node: input');
        if (imported.external === true) throw new Error('browser bundle contains an external input');
      }
    }
  };
  rejectNodeImports(metafile.inputs);
  rejectNodeImports(metafile.outputs);
  if (Object.keys(metafile.outputs).length !== 1) throw new Error('browser metafile must contain exactly one browser output');

  for (const [input, detail] of Object.entries(metafile.inputs)) {
    if (input.startsWith('node:')) throw new Error('browser bundle contains a node: input');
    const lexicalInput = isAbsolute(input) ? resolve(input) : resolve(consumerRoot, input);
    if (!pathInside(lexicalInput, consumerRoot)) throw new Error('browser bundle input is outside the browser consumer');
    let resolvedInput: string;
    try { resolvedInput = realpathSync(lexicalInput); }
    catch { throw new Error(`browser bundle input does not exist: ${input}`); }
    if (!pathInside(resolvedInput, consumerRoot)) throw new Error('browser bundle input is outside the browser consumer');
    const lexicalParts = relative(consumerRoot, lexicalInput).split(sep);
    const resolvedParts = relative(consumerRoot, resolvedInput).split(sep);
    const isDependency = lexicalParts.includes('node_modules') || resolvedParts.includes('node_modules');
    if (isDependency) {
      if (!pathInside(resolvedInput, packageRoot)) throw new Error('browser package input is outside the installed di-bag archive');
      if (pathInside(lexicalInput, packageRoot)
        && relative(packageRoot, lexicalInput).split(sep).join('/') === 'dist/node.js') {
        throw new Error('browser bundle contains the node facade');
      }
      const packageRelative = relative(packageRoot, resolvedInput).split(sep).join('/');
      if (!/^dist\/[^/]+\.js$/.test(packageRelative)) throw new Error('browser package input is not under dist as a JavaScript file');
      if (packageRelative === 'dist/node.js') throw new Error('browser bundle contains the node facade');
      if (resolvedInput === expectedRoot) rootEntries++;
    }
  }
  if (rootEntries !== 1) throw new Error('browser bundle must contain exactly one di-bag root entry');
  return expectedRoot;
}

function inspectBrowserBundle(bundle: BrowserBundle): { bytes: number; gzipBytes: number; contents: Uint8Array } {
  if (!existsSync(bundle.path) || !statSync(bundle.path).isFile()) throw new Error('browser bundle does not exist');
  const bytes = Uint8Array.from(readFileSync(bundle.path));
  if (sha256Bytes(bytes) !== bundle.sha256) throw new Error('bundle SHA-256 mismatch');
  if (bytes.length === 0) throw new Error('browser bundle is empty');
  if (bytes.length !== bundle.bytes) throw new Error('bundle byte count mismatch');
  let gzipBytes: number;
  let gzip: Uint8Array;
  try { gzip = Uint8Array.from(gzipSync(bytes)); gzipBytes = gzip.length; }
  catch { throw new Error('browser bundle gzip failed'); }
  if (gzipBytes !== bundle.gzipBytes) throw new Error('bundle gzip byte count mismatch');
  if (sha256Bytes(gzip) !== bundle.gzipSha256) throw new Error('bundle gzip SHA-256 mismatch');
  if (!existsSync(bundle.metafilePath) || !statSync(bundle.metafilePath).isFile()) throw new Error('browser metafile does not exist');
  const metafileBytes = Uint8Array.from(readFileSync(bundle.metafilePath));
  if (sha256Bytes(metafileBytes) !== bundle.metafileSha256) throw new Error('metafile SHA-256 mismatch');
  let metafile: unknown;
  try { metafile = JSON.parse(new TextDecoder().decode(metafileBytes)); }
  catch { throw new Error('invalid esbuild metafile'); }
  const resolvedRoot = assertBrowserMetafile(metafile, dirname(bundle.path));
  let claimedRoot: string;
  try { claimedRoot = realpathSync(bundle.resolvedDiBag); }
  catch { throw new Error('resolved di-bag root mismatch'); }
  if (claimedRoot !== resolvedRoot) throw new Error('resolved di-bag root mismatch');
  return { bytes: bytes.length, gzipBytes, contents: bytes };
}

export function validateBrowserBundle(bundle: BrowserBundle): { bytes: number; gzipBytes: number } {
  const { bytes, gzipBytes } = inspectBrowserBundle(bundle);
  return { bytes, gzipBytes };
}

export async function bundleBrowserRoot(
  archive: PackedArchive,
  esbuild: VerifiedTool | { status: 'unavailable'; reason: ToolUnavailableReason },
): Promise<BrowserBundle> {
  if (esbuild.status === 'unavailable') throw new Error(`esbuild unavailable: ${esbuild.reason}`);
  if (esbuild.name !== 'esbuild') throw new Error('browser bundling requires the verified esbuild tool');
  const npm = await verifyTool(platformRoot, 'npm');
  if (npm.status === 'unavailable') throw new Error(`npm unavailable: ${npm.reason}`);
  const consumer = mkdtempSync(join(tmpdir(), 'di-bag-browser-consumer-'));
  let retain = false;
  try {
    validatePackedArchive(archive);
    writeFileSync(join(consumer, 'package.json'), '{"private":true,"type":"module"}\n');
    const installed = runExact(npm, ['install', '--offline', '--ignore-scripts', '--no-audit', '--no-fund', '--no-package-lock', archive.path], consumer);
    if (installed.signal !== null || installed.status !== 0 || installed.stderr !== '') throw new Error('offline archive installation failed');
    cpSync(join(platformRoot, 'tests', 'platform', 'portable'), join(consumer, 'portable'), { recursive: true });
    cpSync(join(platformRoot, 'tests', 'platform', 'browser-entry.ts'), join(consumer, 'browser-entry.ts'));
    const path = join(consumer, 'worker.js');
    const metafilePath = join(consumer, 'worker-meta.json');
    const args = [
      'browser-entry.ts', '--bundle', '--platform=browser', '--format=iife', '--target=es2022', '--minify',
      '--tree-shaking=true', '--legal-comments=none', '--log-level=error', `--outfile=${path}`, `--metafile=${metafilePath}`,
    ] as const;
    const result = runExact(esbuild, args, consumer);
    if (result.signal !== null || result.status !== 0 || result.stderr !== '') throw new Error(`browser bundling failed: ${result.stderr || result.stdout}`);
    const bundleBytes = Uint8Array.from(readFileSync(path));
    const metafileBytes = Uint8Array.from(readFileSync(metafilePath));
    const gzipBytes = Uint8Array.from(gzipSync(bundleBytes));
    const resolvedDiBag = assertBrowserMetafile(JSON.parse(new TextDecoder().decode(metafileBytes)), consumer);
    const bundle: BrowserBundle = {
      path,
      sha256: sha256Bytes(bundleBytes),
      bytes: bundleBytes.length,
      gzipBytes: gzipBytes.length,
      gzipSha256: sha256Bytes(gzipBytes),
      metafilePath,
      metafileSha256: sha256Bytes(metafileBytes),
      resolvedDiBag,
    };
    validateBrowserBundle(bundle);
    retain = true;
    return bundle;
  } finally {
    if (!retain) rmSync(consumer, { recursive: true, force: true });
  }
}

export function evaluateBrowserWorkerProtocol(transcript: BrowserWorkerTranscript): PlatformAssertion {
  if (transcript.timedOut) return { status: 'fail', reason: 'Worker timed out' };
  if (transcript.errors.length > 0) return { status: 'fail', reason: `Worker error: ${transcript.errors[0]}` };
  if (transcript.console.length > 0) return { status: 'fail', reason: 'Worker console output is not empty' };
  if (transcript.messages.length === 0) return { status: 'fail', reason: 'Worker posted no message' };
  if (transcript.messages.length !== 1) return { status: 'fail', reason: 'Worker posted extra messages' };
  const message = transcript.messages[0];
  if (!message || typeof message !== 'object' || Array.isArray(message)) return { status: 'fail', reason: 'Worker message is not an object' };
  const value = message as { lane?: unknown; result?: unknown };
  const messageKeys = Reflect.ownKeys(value);
  if (messageKeys.length !== 2 || !messageKeys.includes('lane') || !messageKeys.includes('result')) {
    return { status: 'fail', reason: 'Worker message shape mismatch' };
  }
  if (value.lane !== 'browser-worker-minified') return { status: 'fail', reason: 'Worker lane mismatch' };
  if (!exactStructuredValue(value.result, expectedPortableResult)) return { status: 'fail', reason: 'Worker result mismatch' };
  return { status: 'pass' };
}

function exactStructuredValue(actual: unknown, expected: unknown): boolean {
  if (Object.is(actual, expected)) return true;
  if (!actual || !expected || typeof actual !== 'object' || typeof expected !== 'object') return false;
  if (Array.isArray(actual) !== Array.isArray(expected)) return false;
  const actualKeys = Reflect.ownKeys(actual);
  const expectedKeys = Reflect.ownKeys(expected);
  if (actualKeys.length !== expectedKeys.length || expectedKeys.some(key => !actualKeys.includes(key))) return false;
  return expectedKeys.every(key => exactStructuredValue(
    (actual as Record<PropertyKey, unknown>)[key],
    (expected as Record<PropertyKey, unknown>)[key],
  ));
}

function playwrightPackageEntry(tool: VerifiedTool): string {
  let current = dirname(tool.hashPath);
  while (current !== dirname(current)) {
    const packagePath = join(current, 'package.json');
    if (existsSync(packagePath)) {
      const document = JSON.parse(readFileSync(packagePath, 'utf8')) as { name?: unknown; main?: unknown };
      if (document.name === 'playwright' && typeof document.main === 'string') return join(current, document.main);
    }
    current = dirname(current);
  }
  throw new Error('verified Playwright package entry cannot be resolved');
}

const executeBrowserWorker: BrowserWorkerDriver = async (bundleBytes, chromiumTool, signal) => {
  const playwrightTool = await verifyTool(platformRoot, 'playwright');
  if (playwrightTool.status === 'unavailable') throw new Error(`playwright unavailable: ${playwrightTool.reason}`);
  const module = await import(pathToFileURL(playwrightPackageEntry(playwrightTool)).href) as any;
  const playwright = module.chromium ? module : module.default;
  if (!playwright?.chromium) throw new Error('verified Playwright module has no Chromium API');
  const browser = await playwright.chromium.launch({ executablePath: chromiumTool.hashPath });
  if (signal.aborted) {
    await browser.close();
    return { messages: [], errors: [], console: [], timedOut: true };
  }
  const abort = () => { void browser.close().catch(() => undefined); };
  signal.addEventListener('abort', abort, { once: true });
  const messages: unknown[] = [], errors: string[] = [], consoleOutput: string[] = [];
  let timedOut = false;
  try {
    const page = await browser.newPage();
    page.on('console', (message: any) => { consoleOutput.push(message.text()); });
    page.on('pageerror', (error: Error) => { errors.push(error.message); });
    await page.exposeFunction('__diBagWorkerMessage', (message: unknown) => { messages.push(message); });
    await page.exposeFunction('__diBagWorkerError', (message: string) => { errors.push(message); });
    await page.setContent('<!doctype html><meta charset="utf-8">');
    const source = Buffer.from(bundleBytes).toString('base64');
    await page.evaluate((encoded: string) => {
      const text = atob(encoded);
      const bytes = Uint8Array.from(text, character => character.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: 'text/javascript' }));
      const worker = new Worker(url);
      (globalThis as any).__diBagWorker = worker;
      worker.onmessage = event => { void (globalThis as any).__diBagWorkerMessage(event.data); };
      worker.onerror = event => { event.preventDefault(); void (globalThis as any).__diBagWorkerError(event.message); };
    }, source);
    while (messages.length === 0 && errors.length === 0 && !signal.aborted) {
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    if (signal.aborted) timedOut = true;
    else await new Promise(resolve => setTimeout(resolve, 100));
    await page.evaluate(() => { (globalThis as any).__diBagWorker?.terminate(); });
  } finally {
    signal.removeEventListener('abort', abort);
    await browser.close();
  }
  return { messages, errors, console: consoleOutput, timedOut };
};

export async function runBrowserWorkerLane(
  bundle: BrowserBundle,
  chromium: VerifiedTool | { status: 'unavailable'; reason: ToolUnavailableReason },
  driver?: BrowserWorkerDriver,
  timeoutMs = 6_000,
  unavailablePlaywright?: { status: 'unavailable'; reason: ToolUnavailableReason },
): Promise<PlatformRow> {
  if (chromium.status === 'unavailable') return browserRow('unavailable', { reason: chromium.reason });
  if (chromium.name !== 'chromium') return browserRow('fail', { reason: 'browser Worker lane requires the verified chromium tool' });
  try {
    if (!driver) {
      const playwright = unavailablePlaywright ?? await verifyTool(platformRoot, 'playwright');
      if (playwright.status === 'unavailable') return browserRow('unavailable', { reason: `playwright-${playwright.reason}` });
    }
    const validated = inspectBrowserBundle(bundle);
    const controller = new AbortController();
    const timeout = Symbol('browser-timeout');
    let timer: ReturnType<typeof setTimeout> | undefined;
    const execution = (driver ?? executeBrowserWorker)(validated.contents, chromium, controller.signal);
    let transcript: BrowserWorkerTranscript | typeof timeout;
    try {
      transcript = await Promise.race([
        execution,
        new Promise<typeof timeout>(resolveTimeout => { timer = setTimeout(() => resolveTimeout(timeout), timeoutMs); }),
      ]);
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
    if (transcript === timeout) {
      controller.abort();
      await Promise.race([
        execution.catch(() => undefined),
        new Promise(resolveCleanup => setTimeout(resolveCleanup, 250)),
      ]);
      return browserRow('fail', { reason: 'Worker timed out', bundleSha256: bundle.sha256 });
    }
    const assertion = evaluateBrowserWorkerProtocol(transcript);
    if (assertion.status === 'fail') return browserRow('fail', { reason: assertion.reason, bundleSha256: bundle.sha256 });
    return browserRow('pass', {
      bundleSha256: bundle.sha256,
      bytes: bundle.bytes,
      gzipBytes: bundle.gzipBytes,
      gzipSha256: bundle.gzipSha256,
      metafileSha256: bundle.metafileSha256,
      resolvedDiBag: bundle.resolvedDiBag,
      result: expectedPortableResult,
    });
  } catch (error) {
    return browserRow('fail', { reason: error instanceof Error ? error.message : String(error) });
  }
}

export function evaluateDenoChild(installedPackage: string, supervised: PlatformEnvironment): PlatformAssertion {
  if (supervised.signal !== null) return { status: 'fail', reason: `child terminated by ${supervised.signal}` };
  if (supervised.status !== 0) return { status: 'fail', reason: `child exited with status ${String(supervised.status)}` };
  if (supervised.stderr !== '') return { status: 'fail', reason: 'child stderr is not empty' };
  let actual: unknown;
  try { actual = JSON.parse(supervised.stdout); }
  catch { return { status: 'fail', reason: 'child stdout is not one canonical JSON object' }; }
  if (!actual || typeof actual !== 'object' || Array.isArray(actual)
    || supervised.stdout !== `${stableJson(actual)}\n`) {
    return { status: 'fail', reason: 'child stdout is not one canonical JSON object' };
  }
  const value = actual as { lane?: unknown; resolvedDiBag?: unknown; result?: unknown };
  if (value.lane !== 'deno-root') return { status: 'fail', reason: 'child lane mismatch' };
  if (typeof value.resolvedDiBag !== 'string') return { status: 'fail', reason: 'child result mismatch' };
  let resolvedModule: string;
  let packagePrefix: string;
  try {
    resolvedModule = realpathSync(fileURLToPath(value.resolvedDiBag));
    packagePrefix = `${realpathSync(installedPackage)}${sep}`;
  } catch {
    return { status: 'fail', reason: 'Deno resolved di-bag outside the local archive install' };
  }
  if (!resolvedModule.startsWith(packagePrefix)) {
    return { status: 'fail', reason: 'Deno resolved di-bag outside the local archive install' };
  }
  return evaluatePlatformChild({ lane: 'deno-root', resolvedDiBag: value.resolvedDiBag, result: expectedPortableResult }, supervised);
}

export async function runDenoLane(
  archive: PackedArchive,
  tool: VerifiedTool | { status: 'unavailable'; reason: ToolUnavailableReason },
): Promise<PlatformRow> {
  if (tool.status === 'unavailable') return denoRow('unavailable', { reason: tool.reason });
  if (tool.name !== 'deno') return denoRow('fail', { reason: 'Deno lane requires the verified deno tool' });

  const npm = await verifyTool(platformRoot, 'npm');
  if (npm.status === 'unavailable') return denoRow('unavailable', { reason: `npm-${npm.reason}` });
  const consumer = mkdtempSync(join(tmpdir(), 'di-bag-deno-consumer-'));
  try {
    validatePackedArchive(archive);
    writeFileSync(join(consumer, 'package.json'), '{"private":true,"type":"module"}\n');
    const installed = runExact(npm, ['install', '--offline', '--ignore-scripts', '--no-audit', '--no-fund', '--no-package-lock', archive.path], consumer);
    if (installed.signal !== null || installed.status !== 0 || installed.stderr !== '') {
      return denoRow('fail', { reason: 'offline archive installation failed' });
    }
    const portable = join(consumer, 'portable');
    cpSync(join(platformRoot, 'tests', 'platform', 'portable'), portable, { recursive: true });
    cpSync(join(platformRoot, 'tests', 'platform', 'deno-consumer.ts'), join(consumer, 'deno-consumer.ts'));
    cpSync(join(platformRoot, 'tests', 'platform', 'deno.json'), join(consumer, 'deno.json'));
    const command = ['run', '--node-modules-dir=manual', '--allow-read', 'deno-consumer.ts'] as const;
    const executed = runExact(tool, command, consumer);
    const assertion = evaluateDenoChild(join(consumer, 'node_modules', 'di-bag'), executed);
    if (assertion.status === 'fail') {
      return denoRow('fail', { reason: assertion.reason, archiveSha256: archive.sha256, command: [...tool.argv, ...command] });
    }
    const output = JSON.parse(executed.stdout) as { resolvedDiBag: string; result: unknown };
    return denoRow('pass', {
      archiveSha256: archive.sha256,
      command: [...tool.argv, ...command],
      resolvedDiBag: output.resolvedDiBag,
      result: output.result,
    });
  } catch (error) {
    return denoRow('fail', { reason: error instanceof Error ? error.message : String(error) });
  } finally {
    rmSync(consumer, { recursive: true, force: true });
  }
}

function requiredArchiveFilesFromDocument(document: unknown): string[] {
  if (!document || typeof document !== 'object' || Array.isArray(document)) throw new Error('packed archive has invalid package.json');
  const packageJson = document as {
    exports?: Record<string, { default?: string; types?: string }>;
  };
  const required = new Set(['package.json', 'README.md', 'LICENSE']);
  for (const target of Object.values(packageJson.exports ?? {})) {
    if (typeof target.default === 'string') required.add(target.default.replace(/^\.\//, ''));
    if (typeof target.types === 'string') required.add(target.types.replace(/^\.\//, ''));
  }
  return [...required].sort();
}

function requiredArchiveFiles(packageTree: string): string[] {
  return requiredArchiveFilesFromDocument(JSON.parse(readFileSync(join(packageTree, 'package.json'), 'utf8')));
}

function allowedArchiveFiles(packageTree: string): string[] {
  const allowed = new Set(['package.json', 'README.md', 'LICENSE']);
  const dist = join(packageTree, 'dist');
  if (!existsSync(dist) || !statSync(dist).isDirectory()) throw new Error('isolated package has no dist directory');
  const visit = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile() && !lstatSync(path).isSymbolicLink()) {
        allowed.add(relative(packageTree, path).split(sep).join('/'));
      } else throw new Error(`isolated package has unsupported dist entry ${relative(packageTree, path)}`);
    }
  };
  visit(dist);
  return [...allowed].sort();
}

export function validatePackOutput(packageTree: string, stdout: string, stderr = ''): PackResult {
  if (stderr !== '') throw new Error('npm pack stderr is not empty');
  let parsed: unknown;
  try { parsed = JSON.parse(stdout); }
  catch { throw new Error('npm pack output is not JSON'); }
  if (!Array.isArray(parsed) || parsed.length !== 1) throw new Error('npm pack must produce exactly one archive');
  const result = parsed[0] as Partial<PackResult>;
  if (typeof result.filename !== 'string' || !result.filename || !Array.isArray(result.files)) {
    throw new Error('npm pack result is incomplete');
  }
  if (isAbsolute(result.filename) || basename(result.filename) !== result.filename) {
    throw new Error('npm pack returned an unsafe archive filename');
  }
  const listed = result.files.map(file => file?.path);
  if (listed.some(path => typeof path !== 'string' || !path)) throw new Error('npm pack result has an invalid file entry');
  const files = new Set(listed as string[]);
  if (files.size !== listed.length) throw new Error('npm pack result has duplicate files');
  for (const required of requiredArchiveFiles(packageTree)) {
    if (!files.has(required)) throw new Error(`packed archive is missing ${required}`);
  }
  const allowed = new Set(allowedArchiveFiles(packageTree));
  for (const file of files) if (!allowed.has(file)) throw new Error(`packed archive contains unexpected file ${file}`);
  for (const file of allowed) if (!files.has(file)) throw new Error(`packed archive is missing allowed file ${file}`);
  return result as PackResult;
}

function tarText(bytes: Uint8Array, start: number, length: number): string {
  return new TextDecoder().decode(bytes.subarray(start, start + length)).replace(/\0.*$/s, '');
}

function tarOctal(bytes: Uint8Array, start: number, length: number): number {
  const value = tarText(bytes, start, length).trim();
  if (!/^[0-7]+$/.test(value)) throw new Error('packed archive has an invalid tar header');
  return Number.parseInt(value, 8);
}

function archiveFiles(path: string): Map<string, Uint8Array> {
  let bytes: Uint8Array;
  try { bytes = Uint8Array.from(gunzipSync(Uint8Array.from(readFileSync(path)))); }
  catch { throw new Error('packed archive is not a gzip tar archive'); }
  const files = new Map<string, Uint8Array>();
  let offset = 0, ended = false;
  while (offset + 512 <= bytes.length) {
    const header = bytes.subarray(offset, offset + 512);
    if (header.every(byte => byte === 0)) {
      if (!bytes.subarray(offset).every(byte => byte === 0)) throw new Error('packed archive has nonzero data after tar terminator');
      ended = true; break;
    }
    if (tarText(header, 257, 6) !== 'ustar') throw new Error('packed archive has an invalid tar header');
    const recordedChecksum = tarOctal(header, 148, 8);
    let actualChecksum = 0;
    for (let index = 0; index < header.length; index++) {
      actualChecksum += index >= 148 && index < 156 ? 0x20 : header[index] ?? 0;
    }
    if (recordedChecksum !== actualChecksum) throw new Error('packed archive has an invalid tar checksum');
    const size = tarOctal(header, 124, 12);
    const name = tarText(header, 0, 100);
    const prefix = tarText(header, 345, 155);
    const fullName = prefix ? `${prefix}/${name}` : name;
    const next = offset + 512 + Math.ceil(size / 512) * 512;
    if (!Number.isSafeInteger(size) || next > bytes.length) throw new Error('packed archive has a truncated tar entry');
    const type = header[156];
    if (type !== 0 && type !== 0x30 && type !== 0x35) {
      throw new Error(`packed archive has unsupported tar entry type ${String.fromCharCode(type ?? 0)}`);
    }
    if (type === 0 || type === 0x30) {
      if (!fullName.startsWith('package/')) throw new Error('packed archive has a file outside package/');
      const relative = fullName.slice('package/'.length);
      if (!relative || relative.split('/').some(part => part === '' || part === '.' || part === '..')) {
        throw new Error('packed archive has an unsafe file path');
      }
      if (files.has(relative)) throw new Error(`packed archive has duplicate file ${relative}`);
      files.set(relative, bytes.slice(offset + 512, offset + 512 + size));
    }
    offset = next;
  }
  if (!ended) throw new Error('packed archive has no tar terminator');
  return files;
}

export function validatePackedArchive(archive: PackedArchive): void {
  if (!existsSync(archive.path) || !statSync(archive.path).isFile()) throw new Error('packed archive does not exist');
  if (sha256File(archive.path) !== archive.sha256) throw new Error('packed archive SHA-256 mismatch');
  const claimed = new Set(archive.files);
  const actual = archiveFiles(archive.path);
  if (claimed.size !== archive.files.length) throw new Error('packed archive claimed inventory has duplicates');
  const allowed = new Set(allowedArchiveFiles(archive.packageTree));
  for (const file of claimed) if (!allowed.has(file)) throw new Error(`packed archive contains unexpected file ${file}`);
  for (const file of allowed) if (!claimed.has(file)) throw new Error(`packed archive claimed inventory is missing ${file}`);
  for (const file of actual.keys()) if (!claimed.has(file)) throw new Error(`packed archive bytes contain unclaimed file ${file}`);
  for (const file of claimed) if (!actual.has(file)) throw new Error(`packed archive bytes are missing ${file}`);
  let packedDocument: unknown;
  try { packedDocument = JSON.parse(new TextDecoder().decode(actual.get('package.json'))); }
  catch { throw new Error('packed archive has invalid package.json'); }
  for (const document of ['package.json', 'README.md', 'LICENSE']) {
    const expected = Uint8Array.from(readFileSync(join(archive.packageTree, document)));
    const received = actual.get(document);
    if (!received || expected.length !== received.length || expected.some((byte, index) => received[index] !== byte)) {
      throw new Error(`packed archive content mismatch for ${document}`);
    }
  }
  for (const required of requiredArchiveFilesFromDocument(packedDocument)) {
    if (!claimed.has(required)) throw new Error(`packed archive is missing ${required}`);
    if (!actual.has(required)) throw new Error(`packed archive bytes are missing ${required}`);
  }
}

export async function packIsolatedClassic(root: string, node: VerifiedTool, npm: VerifiedTool, classic6: VerifiedTool): Promise<PackedArchive> {
  if (node.name !== 'node' || npm.name !== 'npm' || classic6.name !== 'classic6'
    || npm.argv[0] !== node.argv[0] || classic6.argv[0] !== node.argv[0]) {
    throw new Error('node, npm and classic6 must share exact runtime');
  }
  const packageTree = mkdtempSync(join(tmpdir(), 'di-bag-platform-'));
  for (const name of ['src', 'package.json', 'tsconfig.json', 'tsconfig.build.json', 'README.md', 'LICENSE']) {
    const source = join(root, name);
    if (!existsSync(source)) throw new Error(`isolated package source is missing ${name}`);
    cpSync(source, join(packageTree, name), { recursive: true });
  }
  const build = runExact(classic6, ['-p', 'tsconfig.build.json'], packageTree);
  if (build.signal !== null || build.status !== 0 || build.stderr !== '') throw new Error(`isolated classic build failed: ${build.stderr || build.stdout}`);
  const packed = runExact(npm, ['pack', '--ignore-scripts', '--json'], packageTree);
  if (packed.signal !== null || packed.status !== 0) throw new Error(`npm pack failed: ${packed.stderr || packed.stdout}`);
  const result = validatePackOutput(packageTree, packed.stdout, packed.stderr);
  const path = resolve(packageTree, result.filename);
  const archive: PackedArchive = { path, packageTree, sha256: sha256File(path), files: result.files.map(file => file.path).sort() };
  validatePackedArchive(archive);
  return archive;
}

export async function writePlatformEvidence(root: string, row: PlatformRow): Promise<string> {
  if (!/^[a-f0-9]{40}$/.test(row.git.sha)) throw new Error('platform evidence row needs an exact 40-character Git SHA');
  let canonicalUtc = false;
  try { canonicalUtc = new Date(row.utc).toISOString() === row.utc; } catch { /* rejected below */ }
  if (!canonicalUtc) throw new Error('platform evidence row needs a canonical UTC ISO timestamp');
  const directory = join(root, 'docs', 'benchmarks', 'results', `${row.utc.slice(0, 10)}-${row.git.sha.slice(0, 7)}`);
  mkdirSync(directory, { recursive: true });
  const path = join(directory, 'platform.jsonl');
  writeFileSync(path, `${stableJson(row)}\n`, { flag: 'a' });
  return path;
}
