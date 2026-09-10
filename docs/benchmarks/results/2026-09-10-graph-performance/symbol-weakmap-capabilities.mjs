import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
const pins = JSON.parse(readFileSync('tools/platform-versions.local.json', 'utf8'));
const probe = `(() => { const a = Symbol('same'), b = Symbol('same'); const map = new WeakMap(); map.set(a, 17); map.set(b, 29); const distinct = map.get(a) === 17 && map.get(b) === 29; const removed = map.delete(a) && !map.has(a) && map.get(b) === 29; let registeredRejected = false; try { map.set(Symbol.for('di-bag-capability-control'), 1); } catch (error) { registeredRejected = error instanceof TypeError; } map.set(Symbol.iterator, 31); return { distinct, removed, registeredRejected, wellKnown: map.get(Symbol.iterator) === 31 }; })()`;
const rows = [];
for (const host of ['node', 'bun', 'deno']) {
  const argv = [...pins[host].argv, host === 'deno' ? 'eval' : '-e', `console.log(JSON.stringify(${probe}))`];
  const result = spawnSync(argv[0], argv.slice(1), { encoding: 'utf8', timeout: 10000 });
  rows.push({ host, version: pins[host].version, argv, status: result.status, signal: result.signal, stdout: result.stdout, stderr: result.stderr, error: result.error?.message });
}
const require = createRequire(import.meta.url);
const { chromium } = require('/home/df/wd/personal/di-bag/tools/platform/node_modules/playwright');
const browser = await chromium.launch({ executablePath: pins.chromium.argv[0], headless: true });
try {
  const page = await browser.newPage();
  rows.push({ host: 'chromium', version: browser.version(), executable: pins.chromium.argv[0], result: await page.evaluate(probe), status: 0 });
} finally { await browser.close(); }
writeFileSync(new URL('./symbol-weakmap-capabilities.json', import.meta.url), JSON.stringify({ probe, rows }, null, 2) + '\n');
console.log(JSON.stringify(rows));
