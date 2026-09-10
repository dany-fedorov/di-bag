import { spawn } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
for (const exitCode of [0, 2]) {
  const child = spawn('/bin/bash', ['-c', `printf -v memory '%67108864s' ''; printf 'out\\n'; printf 'err\\n' >&2; exit ${exitCode}`]);
  let stdout = '', stderr = '';
  child.stdout.on('data', bytes => stdout += bytes); child.stderr.on('data', bytes => stderr += bytes);
  const closed = new Promise(resolve => child.once('close', (status, signal) => resolve({ status, signal, stdout, stderr })));
  const start = performance.now(), snapshots = [];
  let preZombieSamples = 0, firstMilliseconds, lastMilliseconds;
  while (performance.now() - start < 3000) {
    const status = readFileSync(`/proc/${child.pid}/status`, 'utf8');
    if (!/^VmRSS:/m.test(status) && /^State:\s+R/m.test(status)) {
      const milliseconds = performance.now() - start;
      preZombieSamples++; firstMilliseconds ??= milliseconds; lastMilliseconds = milliseconds;
      if (snapshots.length < 4) snapshots.push({ milliseconds, status, tasks: readdirSync(`/proc/${child.pid}/task`).map(tid => ({ tid, stat: readFileSync(`/proc/${child.pid}/task/${tid}/stat`, 'utf8') })) });
    }
    if (/^State:\s+[ZX]/m.test(status)) break;
  }
  console.log(JSON.stringify({ exitCode, pid: child.pid, preZombieSamples, firstMilliseconds, lastMilliseconds, observedWindowMilliseconds: lastMilliseconds - firstMilliseconds, snapshots, result: await closed }));
}
