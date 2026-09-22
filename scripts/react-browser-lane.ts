import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { platformGit, playwrightPackageEntry, stableJson, verifyTool } from './platform-evidence.ts';
import type { PlatformRow, ToolUnavailableReason, VerifiedTool } from './platform-evidence.ts';
import type { ScenarioReport } from '../examples/react/browser-scenario.tsx';

export type ReactBuildMode = 'development' | 'production';
export type ReactBundle = {
  readonly mode: ReactBuildMode;
  readonly path: string;
  readonly sha256: string;
  readonly bytes: number;
  readonly metafilePath: string;
  /** The installed react version, read from node_modules; the scenario reports `React.version` and they must agree. */
  readonly react: string;
};
export type ReactConsoleMessage = { readonly type: string; readonly text: string };
export type ReactPageTranscript = {
  readonly reports: readonly unknown[];
  readonly errors: readonly string[];
  readonly console: readonly ReactConsoleMessage[];
  readonly timedOut: boolean;
};
export type ReactPageDriver = (bundleBytes: Uint8Array, chromium: VerifiedTool, signal: AbortSignal) => Promise<ReactPageTranscript>;
type Unavailable = { status: 'unavailable'; reason: ToolUnavailableReason };
type Assertion = { status: 'pass' } | { status: 'fail'; reason: string };

const laneRoot = resolve(process.cwd());
const laneScript = resolve(laneRoot, 'scripts', 'react-browser-lane.ts');
const allowedInputRoots = ['src/', 'examples/react/', 'node_modules/react/', 'node_modules/react-dom/', 'node_modules/scheduler/'];
const quietConsole = new Set(['log', 'info', 'debug']);

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

export function laneName(mode: ReactBuildMode): string {
  return `react-page-${mode}`;
}

/** The one scenario, as the page must report it. Only the Strict Mode generation differs between builds. */
export function expectedReactReport(mode: ReactBuildMode, react: string): ScenarioReport {
  const lockEvents = [
    'acquire:alpha', 'release:alpha', 'acquire:beta', 'release:beta', 'acquire:broken', 'release:broken',
    'acquire:alpha', 'release:alpha', 'acquire:gamma', 'release:gamma',
  ];
  return {
    lane: mode === 'development' ? 'react-page-development' : 'react-page-production',
    react,
    mounted: { status: 'ready', project: 'alpha', generation: mode === 'development' ? 2 : 1 },
    documentAdded: { count: 1 },
    switchedToBeta: { status: 'ready', project: 'beta', lockEvents: lockEvents.slice(0, 3) },
    brokenFailed: { status: 'failed', message: 'no manifest for broken', lockEvents: lockEvents.slice(0, 6) },
    backToAlpha: { status: 'ready', project: 'alpha', documents: 1 },
    unmounted: { state: 'idle', lockEvents: lockEvents.slice(0, 8) },
    unmountDuringStartup: { state: 'idle', gammaCalls: 1, lockEvents, published: false },
    closed: { transportCloses: 1, failures: [], unhandled: [] },
  };
}

type MetafileImport = { path?: unknown; external?: unknown };

/** Inputs must come from src, the example, or the React packages; nothing external, nothing from node. */
export function assertReactMetafile(value: unknown): void {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid esbuild metafile');
  const { inputs, outputs } = value as { inputs?: unknown; outputs?: unknown };
  if (!inputs || typeof inputs !== 'object' || Array.isArray(inputs) || !outputs || typeof outputs !== 'object' || Array.isArray(outputs)) {
    throw new Error('invalid esbuild metafile');
  }
  if (Object.keys(outputs).length !== 1) throw new Error('react bundle must have exactly one output');
  for (const [input, detail] of Object.entries(inputs as Record<string, unknown>)) {
    if (input.startsWith('node:')) throw new Error(`react bundle contains a node: input: ${input}`);
    if (isAbsolute(input) || input.split('/').includes('..')) throw new Error(`react bundle input is outside the repository: ${input}`);
    if (!allowedInputRoots.some(prefix => input.startsWith(prefix))) throw new Error(`react bundle input is outside the allowed roots: ${input}`);
    const imports = (detail as { imports?: unknown } | null)?.imports ?? [];
    if (!Array.isArray(imports)) throw new Error('invalid esbuild metafile');
    for (const imported of imports as MetafileImport[]) {
      if (typeof imported?.path !== 'string') throw new Error('invalid esbuild metafile');
      if (imported.path.startsWith('node:')) throw new Error(`react bundle contains a node: input: ${imported.path}`);
      if (imported.external === true) throw new Error(`react bundle contains an external input: ${imported.path}`);
    }
  }
}

export function installedReactVersion(root = laneRoot): string {
  const manifest = JSON.parse(readFileSync(join(root, 'node_modules', 'react', 'package.json'), 'utf8')) as { version?: unknown };
  if (typeof manifest.version !== 'string') throw new Error('installed react package has no version');
  return manifest.version;
}

/** Bundle one entry with the verified esbuild. Development keeps Strict Mode's double invocation; production is what ships. */
export function bundleReactEntry(
  esbuild: VerifiedTool | Unavailable,
  mode: ReactBuildMode,
  options: { readonly entry?: string; readonly format?: 'esm' | 'iife'; readonly root?: string } = {},
): ReactBundle {
  if (esbuild.status === 'unavailable') throw new Error(`esbuild unavailable: ${esbuild.reason}`);
  if (esbuild.name !== 'esbuild') throw new Error('react bundling requires the verified esbuild tool');
  const root = options.root ?? laneRoot;
  const entry = options.entry ?? 'examples/react/browser-scenario.tsx';
  const out = mkdtempSync(join(tmpdir(), `di-bag-react-${mode}-`));
  const path = join(out, 'bundle.js');
  const metafilePath = join(out, 'bundle-meta.json');
  const args = [
    entry, '--bundle', '--platform=browser', `--format=${options.format ?? 'esm'}`, '--target=es2022', '--jsx=automatic',
    `--define:process.env.NODE_ENV="${mode}"`, ...(mode === 'production' ? ['--minify'] : ['--jsx-dev']),
    '--log-level=error', `--outfile=${path}`, `--metafile=${metafilePath}`,
  ];
  const result = spawnSync(esbuild.argv[0], [...esbuild.argv.slice(1), ...args], { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  if (result.error) throw result.error;
  if (result.signal !== null || result.status !== 0 || result.stderr !== '') {
    rmSync(out, { recursive: true, force: true });
    throw new Error(`react bundling failed: ${result.stderr || result.stdout}`);
  }
  assertReactMetafile(JSON.parse(readFileSync(metafilePath, 'utf8')));
  const bytes = Uint8Array.from(readFileSync(path));
  return { mode, path, sha256: sha256(bytes), bytes: bytes.length, metafilePath, react: installedReactVersion(root) };
}

export function evaluateReactPageProtocol(transcript: ReactPageTranscript, expected: ScenarioReport): Assertion {
  if (transcript.timedOut) return { status: 'fail', reason: 'page timed out' };
  if (transcript.errors.length > 0) return { status: 'fail', reason: `page error: ${transcript.errors[0]}` };
  const noisy = transcript.console.find(message => !quietConsole.has(message.type));
  if (noisy) return { status: 'fail', reason: `page console ${noisy.type}: ${noisy.text}` };
  if (transcript.reports.length === 0) return { status: 'fail', reason: 'page posted no report' };
  if (transcript.reports.length !== 1) return { status: 'fail', reason: 'page posted extra reports' };
  let actual: string;
  try { actual = stableJson(transcript.reports[0]); }
  catch { return { status: 'fail', reason: 'page report mismatch' }; }
  if (actual !== stableJson(expected)) return { status: 'fail', reason: 'page report mismatch' };
  return { status: 'pass' };
}

/** A page, not a Worker: React needs a document. The module script runs the scenario and reports through an exposed function. */
export const executeReactPage: ReactPageDriver = async (bundleBytes, chromiumTool, signal) => {
  const playwrightTool = await verifyTool(laneRoot, 'playwright');
  if (playwrightTool.status === 'unavailable') throw new Error(`playwright unavailable: ${playwrightTool.reason}`);
  const module = await import(pathToFileURL(playwrightPackageEntry(playwrightTool)).href) as any;
  const playwright = module.chromium ? module : module.default;
  if (!playwright?.chromium) throw new Error('verified Playwright module has no Chromium API');
  const browser = await playwright.chromium.launch({ executablePath: chromiumTool.hashPath });
  if (signal.aborted) {
    await browser.close();
    return { reports: [], errors: [], console: [], timedOut: true };
  }
  const abort = () => { void browser.close().catch(() => undefined); };
  signal.addEventListener('abort', abort, { once: true });
  const reports: unknown[] = [], errors: string[] = [], consoleOutput: ReactConsoleMessage[] = [];
  let timedOut = false;
  try {
    const page = await browser.newPage();
    page.on('console', (message: any) => { consoleOutput.push({ type: message.type(), text: message.text() }); });
    page.on('pageerror', (error: Error) => { errors.push(error.message); });
    await page.exposeFunction('__diBagReactReport', (report: unknown) => { reports.push(report); });
    await page.exposeFunction('__diBagReactError', (message: string) => { errors.push(message); });
    await page.setContent('<!doctype html><meta charset="utf-8"><title>di-bag react scenario</title>');
    await page.addScriptTag({ content: new TextDecoder().decode(bundleBytes), type: 'module' });
    while (reports.length === 0 && errors.length === 0 && !signal.aborted) {
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    if (signal.aborted) timedOut = true;
    else await new Promise(resolve => setTimeout(resolve, 100));
  } finally {
    signal.removeEventListener('abort', abort);
    await browser.close();
  }
  return { reports, errors, console: consoleOutput, timedOut };
};

function describeTool(tool: VerifiedTool | Unavailable): Record<string, unknown> {
  return tool.status === 'unavailable' ? { status: 'unavailable', reason: tool.reason } : { status: 'pinned', version: tool.version, sha256: tool.sha256 };
}

export async function runReactPageLane(
  bundle: ReactBundle,
  chromium: VerifiedTool | Unavailable,
  driver?: ReactPageDriver,
  timeoutMs = 30_000,
  unavailablePlaywright?: Unavailable,
): Promise<PlatformRow> {
  const row = (status: PlatformRow['status'], fields: Record<string, unknown> = {}): PlatformRow => ({
    schema: 1, lane: laneName(bundle.mode), status, utc: new Date().toISOString(), git: platformGit(),
    react: bundle.react, mode: bundle.mode, bundleSha256: bundle.sha256, bytes: bundle.bytes, ...fields,
  });
  if (chromium.status === 'unavailable') return row('unavailable', { reason: chromium.reason });
  if (chromium.name !== 'chromium') return row('fail', { reason: 'react page lane requires the verified chromium tool' });
  try {
    if (!driver) {
      const playwright = unavailablePlaywright ?? await verifyTool(laneRoot, 'playwright');
      if (playwright.status === 'unavailable') return row('unavailable', { reason: `playwright-${playwright.reason}` });
    }
    if (!existsSync(bundle.path) || !statSync(bundle.path).isFile()) throw new Error('react bundle does not exist');
    const bytes = Uint8Array.from(readFileSync(bundle.path));
    if (sha256(bytes) !== bundle.sha256) throw new Error('react bundle SHA-256 mismatch');
    const controller = new AbortController();
    const timeout = Symbol('react-page-timeout');
    let timer: ReturnType<typeof setTimeout> | undefined;
    const execution = (driver ?? executeReactPage)(bytes, chromium, controller.signal);
    let transcript: ReactPageTranscript | typeof timeout;
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
      await Promise.race([execution.catch(() => undefined), new Promise(resolveCleanup => setTimeout(resolveCleanup, 250))]);
      return row('fail', { reason: 'page timed out' });
    }
    const assertion = evaluateReactPageProtocol(transcript, expectedReactReport(bundle.mode, bundle.react));
    if (assertion.status === 'fail') return row('fail', { reason: assertion.reason, console: transcript.console, report: transcript.reports[0] ?? null });
    return row('pass', { console: transcript.console, chromium: chromium.version });
  } catch (error) {
    return row('fail', { reason: error instanceof Error ? error.message : String(error) });
  }
}

export function writeReactEvidence(root: string, rows: readonly PlatformRow[]): string {
  const first = rows[0];
  if (!first) throw new Error('no react evidence rows');
  const directory = join(root, 'docs', 'benchmarks', 'results', `${first.utc.slice(0, 10)}-${first.git.sha.slice(0, 7)}`);
  mkdirSync(directory, { recursive: true });
  const path = join(directory, 'react-browser.jsonl');
  writeFileSync(path, `${rows.map(row => stableJson(row)).join('\n')}\n`);
  return path;
}

/** Both builds, one row each, written next to the platform evidence. */
export async function runReactBrowserEvidence(root = laneRoot): Promise<readonly PlatformRow[]> {
  const [esbuild, playwright, chromium] = await Promise.all([verifyTool(root, 'esbuild'), verifyTool(root, 'playwright'), verifyTool(root, 'chromium')]);
  const tools = { esbuild: describeTool(esbuild), playwright: describeTool(playwright), chromium: describeTool(chromium) };
  const rows: PlatformRow[] = [];
  for (const mode of ['development', 'production'] as const) {
    let row: PlatformRow;
    if (esbuild.status === 'unavailable') {
      row = { schema: 1, lane: laneName(mode), status: 'unavailable', reason: `esbuild-${esbuild.reason}`, utc: new Date().toISOString(), git: platformGit() };
    } else {
      let bundle: ReactBundle | undefined;
      try {
        bundle = bundleReactEntry(esbuild, mode, { root });
        row = await runReactPageLane(bundle, chromium, undefined, 30_000, playwright.status === 'unavailable' ? playwright : undefined);
      } catch (error) {
        row = { schema: 1, lane: laneName(mode), status: 'fail', reason: error instanceof Error ? error.message : String(error), utc: new Date().toISOString(), git: platformGit() };
      } finally {
        if (bundle) rmSync(dirname(bundle.path), { recursive: true, force: true });
      }
    }
    rows.push({ ...row, tools });
  }
  writeReactEvidence(root, rows);
  return rows;
}

/** A page a person can open from disk: a classic script, because file:// blocks module scripts. */
export function writeReactPage(esbuild: VerifiedTool | Unavailable, directory: string, root = laneRoot): string {
  const bundle = bundleReactEntry(esbuild, 'development', { entry: 'examples/react/main.tsx', format: 'iife', root });
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, 'main.js'), Uint8Array.from(readFileSync(bundle.path)));
  rmSync(dirname(bundle.path), { recursive: true, force: true });
  const path = join(directory, 'index.html');
  writeFileSync(path, '<!doctype html>\n<meta charset="utf-8">\n<title>DI Bag React example</title>\n<div id="root"></div>\n<script src="./main.js"></script>\n');
  return path;
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === laneScript) {
  const args = process.argv.slice(2);
  const fail = (error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exitCode = 1;
  };
  if (args[0] === '--page' && args.length === 1) {
    verifyTool(laneRoot, 'esbuild')
      .then(esbuild => { process.stdout.write(`${writeReactPage(esbuild, mkdtempSync(join(tmpdir(), 'di-bag-react-page-')))}\n`); })
      .catch(fail);
  } else if (args.length === 0 || (args.length === 1 && args[0] === '--required')) {
    runReactBrowserEvidence().then(rows => {
      for (const row of rows) process.stdout.write(`${stableJson(row)}\n`);
      process.exitCode = args[0] === '--required'
        ? (rows.every(row => row.status === 'pass') ? 0 : 1)
        : (rows.some(row => row.status === 'fail') ? 1 : 0);
    }).catch(fail);
  } else {
    process.stderr.write('Usage: node scripts/react-browser-lane.ts [--required | --page]\n');
    process.exit(1);
  }
}
