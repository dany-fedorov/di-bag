import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, realpathSync, renameSync, writeFileSync } from 'node:fs';
import { delimiter, isAbsolute, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { PlatformVersions, ToolPin } from './platform-evidence.ts';

/** Capture an installed tool, rejecting unsuccessful or unexpected version probes. */
export function captureToolPin(
  argv: readonly [string, ...string[]], expectedVersion: string, versionArgs: readonly string[] = ['--version'],
): Extract<ToolPin, { status: 'pinned' }> {
  if (!argv.every(isAbsolute)) throw new Error('tool invocation paths must be absolute');
  if (!/^\d+(?:\.\d+){2,3}$/.test(expectedVersion)) throw new Error('expected tool version must be exact');
  const versionArgv = [...argv, ...versionArgs] as [string, ...string[]];
  const probe = spawnSync(versionArgv[0], versionArgv.slice(1), {
    encoding: 'utf8', timeout: 10_000, maxBuffer: 1024 * 1024,
  });
  if (probe.error || probe.status !== 0 || probe.signal !== null || probe.stderr !== '') {
    throw new Error(`tool version probe failed: ${argv.join(' ')}: ${probe.error?.message ?? probe.stderr}`);
  }
  const observed = probe.stdout.split('\n')[0]?.match(/(?:^|\s)v?(\d+(?:\.\d+){2,3}(?:[-+][\w.-]+)?)(?=\s|$)/)?.[1];
  if (observed !== expectedVersion) {
    throw new Error(`tool version mismatch: expected ${expectedVersion}, received ${probe.stdout.trim()}`);
  }
  const bytes = readFileSync(argv[1] ?? argv[0]);
  return {
    status: 'pinned', argv: [...argv], versionArgv, version: expectedVersion, versionText: probe.stdout,
    sha256: createHash('sha256').update(new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength)).digest('hex'),
  };
}

function executable(name: string): string {
  for (const directory of (process.env.PATH ?? '').split(delimiter)) {
    if (!directory) continue;
    const path = resolve(directory, name);
    if (existsSync(path)) return realpathSync(path);
  }
  throw new Error(`${name} is not installed on PATH`);
}

/** Does not install tools or access the network. Writes only after all probes pass. */
export async function pinPlatformTools(root: string, all: boolean): Promise<PlatformVersions> {
  const node = realpathSync(process.execPath);
  const unavailable = { status: 'unavailable', reason: 'not-provisioned' } as const;
  const manifest: PlatformVersions = {
    schema: 1,
    node: captureToolPin([node], '24.20.0'),
    npm: captureToolPin([node, executable('npm')], '11.19.0'),
    classic6: captureToolPin([node, join(root, 'node_modules/typescript/bin/tsc6')], '6.0.3'),
    bun: captureToolPin([executable('bun')], '1.4.0'),
    deno: unavailable, esbuild: unavailable, playwright: unavailable, chromium: unavailable,
  };
  if (all) {
    const directory = join(root, 'tools/platform');
    const packages = join(directory, 'node_modules');
    const expected = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8')) as {
      dependencies: Record<'deno' | 'esbuild' | 'playwright', string>;
    };
    for (const name of ['deno', 'esbuild', 'playwright'] as const) {
      const installed = JSON.parse(readFileSync(join(packages, name, 'package.json'), 'utf8')) as { version: string };
      if (installed.version !== expected.dependencies[name]) throw new Error(`${name} package version mismatch`);
    }
    manifest.deno = captureToolPin([realpathSync(join(packages, 'deno/deno'))], expected.dependencies.deno);
    manifest.esbuild = captureToolPin([realpathSync(join(packages, 'esbuild/bin/esbuild'))], expected.dependencies.esbuild);
    manifest.playwright = captureToolPin([node, join(packages, 'playwright/cli.js')], expected.dependencies.playwright);
    process.env.PLAYWRIGHT_BROWSERS_PATH ??= join(directory, '.browsers');
    const imported = await import(pathToFileURL(join(packages, 'playwright/index.js')).href);
    const playwright = imported.default ?? imported;
    const browsers = JSON.parse(readFileSync(join(packages, 'playwright-core/browsers.json'), 'utf8')) as {
      browsers: Array<{ name: string; browserVersion: string }>;
    };
    const chromium = browsers.browsers.find(browser => browser.name === 'chromium');
    if (!chromium) throw new Error('Playwright Chromium version is missing');
    manifest.chromium = captureToolPin([realpathSync(playwright.chromium.executablePath())], chromium.browserVersion);
  }
  const destination = join(root, 'tools/platform-versions.local.json');
  const temporary = `${destination}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(manifest, null, 2)}\n`);
  renameSync(temporary, destination);
  return manifest;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve('scripts/pin-platform-tools.ts')) {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length === 1 && args[0] !== '--all')) {
    process.stderr.write('Usage: node scripts/pin-platform-tools.ts [--all]\n');
    process.exit(1);
  }
  pinPlatformTools(resolve('.'), args[0] === '--all').then(manifest => {
    for (const [name, pin] of Object.entries(manifest)) {
      if (typeof pin === 'object') process.stdout.write(`${name}: ${pin.status === 'pinned' ? pin.version : pin.reason}\n`);
    }
  }).catch(error => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
