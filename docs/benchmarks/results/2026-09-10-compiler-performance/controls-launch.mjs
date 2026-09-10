import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const args = process.argv.slice(2);
const worker = fileURLToPath(new URL('./controls.ts', import.meta.url));
const argv = ['--max-old-space-size=3072', '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', worker, ...args];
const child = spawnSync(process.execPath, argv, {
  cwd: process.cwd(), encoding: 'utf8', timeout: args[0] === 'classic' ? 60_000 : 70_000,
  maxBuffer: 4_194_304,
});
console.log(JSON.stringify({ argv: [process.execPath, ...argv], status: child.status, signal: child.signal,
  stdout: child.stdout, stderr: child.stderr, ...(child.error ? { error: child.error.message } : {}) }));
