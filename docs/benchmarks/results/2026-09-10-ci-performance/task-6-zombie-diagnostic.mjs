import { supervise } from '../../../../scripts/native-process.ts';
import { readFileSync, writeFileSync } from 'node:fs';
const delay = new Int32Array(new SharedArrayBuffer(4));
let observation;
const result = await supervise('node', ['-e', "setTimeout(() => console.log('expected output'), 50);"], process.cwd(), { timeoutMilliseconds: 3000, maxRssMiB: 256, maxOutputBytes: 4096, sampleMilliseconds: 20 }, async pid => {
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    try {
      const status = readFileSync(`/proc/${pid}/status`, 'utf8');
      if (/^State:\s+[ZX]/m.test(status)) {
        let exists = false;
        try { exists = process.kill(pid, 0); } catch {}
        observation = { pid, state: status.match(/^State:.*$/m)?.[0], exists };
        throw Object.assign(new Error('status read ESRCH during zombie exit'), { code: 'ESRCH', diagnosticExit: true });
      }
    } catch (error) {
      if (error.diagnosticExit) throw error;
      if (error.code === 'ENOENT' || error.code === 'ESRCH') {
        observation = { pid, code: error.code };
        throw error;
      }
      throw error;
    }
    Atomics.wait(delay, 0, 0, 1);
  }
  throw new Error('diagnostic child did not reach a stopped state');
});
const row = { host: process.versions.bun ? `bun${process.versions.bun}` : `node${process.versions.node}`, observation, result };
writeFileSync(new URL(`./task-6-zombie-green-${process.versions.bun ? 'bun' : 'node'}.json`, import.meta.url), JSON.stringify(row, null, 2) + '\n');
console.log(JSON.stringify(row));
