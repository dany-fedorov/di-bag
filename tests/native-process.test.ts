import { expect, spyOn, test } from 'bun:test';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { supervise, validateLimits } from '../scripts/native-process.ts';

const limits = { timeoutMilliseconds: 3000, maxRssMiB: 256, maxOutputBytes: 4096, sampleMilliseconds: 20 };
const node = execFileSync('node', ['-p', 'process.execPath'], { encoding: 'utf8', timeout: 10000 }).trim();
const child = (source: string, changes = {}) => supervise(node, ['-e', source], process.cwd(), { ...limits, ...changes });

const pause = () => new Promise(resolve => setTimeout(resolve, 5));
async function waitForExit(pid: number): Promise<void> {
  const deadline = Date.now() + limits.timeoutMilliseconds;
  while (Date.now() < deadline) {
    try { process.kill(pid, 0); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ESRCH') return;
      throw error;
    }
    await pause();
  }
  throw new Error(`Child ${pid} was not reaped`);
}

for (const failure of ['EIO', 'EACCES', 'ENOENT', 'ESRCH', 'missing VmRSS', 'malformed VmRSS'] as const) {
  test(`supervisor terminates and reaps a live child on monitor ${failure}`, async () => {
    let pid = 0, samples = 0;
    const result = await supervise(node, ['-e', 'setInterval(() => {}, 1000)'], process.cwd(), limits, async childPid => {
      pid = childPid;
      const status = await readFile(`/proc/${pid}/status`, 'utf8');
      process.kill(pid, 0);
      samples++;
      if (failure === 'malformed VmRSS') return status.replace(/^VmRSS:.*$/m, 'VmRSS: invalid kB');
      if (failure === 'missing VmRSS') return status.replace(/^VmRSS:.*\n/m, '');
      throw Object.assign(new Error(`status read ${failure}`), { code: failure });
    });
    expect(result).toMatchObject({ terminationReason: 'monitor', status: null, signal: 'SIGKILL', stdout: '', stderr: '' });
    expect(result.error).toContain(failure.endsWith('VmRSS') ? 'VmRSS is missing' : failure);
    expect(samples).toBe(failure.endsWith('VmRSS') ? 2 : 1);
    expect(pid).toBeGreaterThan(0);
    expect(() => process.kill(pid, 0)).toThrow();
    expect(result.milliseconds).toBeLessThan(limits.timeoutMilliseconds);
  });
}

for (const failure of ['ENOENT', 'ESRCH'] as const) {
  test(`supervisor drains and reaps a zombie when status reports ${failure} before the exit callback`, async () => {
    let zombiePid = 0;
    const delay = new Int32Array(new SharedArrayBuffer(4));
    const result = await supervise(node, ['-e', "setTimeout(() => { console.log('out'); console.error('err'); }, 50)"], process.cwd(), limits, async pid => {
      // Block JS exit notification while the real child exits. kill(pid, 0)
      // still succeeds for this zombie; only its process state proves exit.
      const deadline = Date.now() + 2000;
      while (Date.now() < deadline) {
        if (/^State:\s+Z/m.test(readFileSync(`/proc/${pid}/status`, 'utf8'))) {
          process.kill(pid, 0);
          zombiePid = pid;
          throw Object.assign(new Error(`status read ${failure} during zombie exit`), { code: failure });
        }
        Atomics.wait(delay, 0, 0, 1);
      }
      throw new Error('Child did not reach zombie state before exit notification');
    });
    expect(zombiePid).toBeGreaterThan(0);
    expect(result).toMatchObject({ status: 0, signal: null, stdout: 'out\n', stderr: 'err\n' });
    expect(result.terminationReason).toBeUndefined();
    expect(result.error).toBeUndefined();
    expect(() => process.kill(zombiePid, 0)).toThrow();
  });
}

for (const exitCode of [0, 2]) {
  test(`supervisor confirms exit ${exitCode} after stale non-zombie status loses VmRSS`, async () => {
    let zombiePid = 0, samples = 0;
    const delay = new Int32Array(new SharedArrayBuffer(4));
    const source = `setTimeout(() => { console.log('out'); console.error('err'); process.exitCode = ${exitCode}; }, 150)`;
    const result = await supervise(node, ['-e', source], process.cwd(), limits, async pid => {
      if (samples >= 2) return readFile(`/proc/${pid}/status`, 'utf8');
      // Model two missing-RSS reads; the second async snapshot is stale by the
      // time its promise resumes. Keep the real child, exit state and pipes.
      const status = await readFile(`/proc/${pid}/status`, 'utf8');
      if (/^State:\s+[ZX]/m.test(status)) throw new Error('Expected a live snapshot');
      samples++;
      if (samples === 2) {
        const deadline = Date.now() + 2000;
        while (Date.now() < deadline) {
          if (/^State:\s+Z/m.test(readFileSync(`/proc/${pid}/status`, 'utf8'))) {
            process.kill(pid, 0);
            zombiePid = pid;
            break;
          }
          Atomics.wait(delay, 0, 0, 1);
        }
        if (!zombiePid) throw new Error('Child did not become a zombie before exit notification');
      }
      return status.replace(/^VmRSS:.*\n/m, '');
    });
    expect(zombiePid).toBeGreaterThan(0);
    expect(samples).toBe(2);
    expect(result).toMatchObject({ status: exitCode, signal: null, stdout: 'out\n', stderr: 'err\n' });
    expect(result.terminationReason).toBeUndefined();
    expect(result.error).toBeUndefined();
    expect(() => process.kill(zombiePid, 0)).toThrow();
  });
}

test('supervisor confirms ESRCH process disappearance before its exit callback runs', async () => {
  let sampledPid = 0, probes = 0;
  const kill = process.kill.bind(process);
  // Model the OS reporting a departed PID before the JS child-exit notification.
  // Keep a real child and real pipes to verify that completion still drains them.
  const probe = spyOn(process, 'kill').mockImplementation((pid, signal) => {
    if (pid === sampledPid && signal === 0) {
      probes++;
      throw Object.assign(new Error('process no longer exists'), { code: 'ESRCH' });
    }
    return kill(pid, signal);
  });
  try {
    const result = await supervise(node, ['-e', "setTimeout(() => { console.log('out'); console.error('err'); }, 50)"], process.cwd(), limits, async pid => {
      sampledPid = pid;
      throw Object.assign(new Error('status read ESRCH during exit'), { code: 'ESRCH' });
    });
    expect(result).toMatchObject({ status: 0, signal: null, stdout: 'out\n', stderr: 'err\n' });
    expect(result.terminationReason).toBeUndefined();
    expect(probes).toBeGreaterThan(0);
  } finally { probe.mockRestore(); }
});

for (const sampleResult of ['missing VmRSS during exit', 'ENOENT after exit', 'ESRCH after exit'] as const) {
  test(`supervisor drains streams and awaits pending sample cleanup for ${sampleResult}`, async () => {
    let release!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; });
    let sampled!: () => void;
    const reaped = new Promise<void>(resolve => { sampled = resolve; });
    let samples = 0, completed = false, sampleCompleted = false;
    const running = supervise(node, ['-e', "setTimeout(() => { console.log('out'); console.error('err'); }, 50)"], process.cwd(), limits, async pid => {
      samples++;
      if (sampleResult === 'missing VmRSS during exit' && samples === 1) return 'State:\tR (running)\n';
      await waitForExit(pid);
      sampled();
      await held;
      sampleCompleted = true;
      if (sampleResult !== 'missing VmRSS during exit') throw Object.assign(new Error('process exited'), { code: sampleResult.split(' ')[0] });
      return 'State:\tZ (zombie)\n';
    }).then(result => { completed = true; return result; });
    try {
      await Promise.race([reaped, running]);
      // Allow the real child's close event to run while the status read is held.
      await pause();
      expect(completed).toBe(false);
      expect(sampleCompleted).toBe(false);
    } finally { release(); }
    const result = await running;
    expect(sampleCompleted).toBe(true);
    expect(result).toMatchObject({ status: 0, signal: null, stdout: 'out\n', stderr: 'err\n' });
    expect(result.terminationReason).toBeUndefined();
    expect(samples).toBe(sampleResult === 'missing VmRSS during exit' ? 2 : 1);
  });
}

test('monitor termination waits for inherited stdout and stderr to close', async () => {
  // A separately bounded writer keeps both real pipes open until its parent is reaped.
  const writer = `
    const parent = process.ppid;
    const deadline = setTimeout(() => process.exit(3), 2000);
    const interval = setInterval(() => {
      try { process.kill(parent, 0); }
      catch (error) {
        if (error.code !== 'ESRCH') throw error;
        clearInterval(interval); clearTimeout(deadline);
        console.log('after exit out'); console.error('after exit err');
      }
    }, 5);
    console.log('writer ready');
    process.title = 'di-bag-ready';
  `;
  const source = `require('node:child_process').spawn(process.execPath, ['-e', ${JSON.stringify(writer)}], { stdio: ['ignore', 1, 2] }); setInterval(() => {}, 1000);`;
  let parent = 0;
  const result = await supervise(node, ['-e', source], process.cwd(), limits, async pid => {
    parent = pid;
    // Wait for the writer to start, so it records the original live parent PID.
    const deadline = Date.now() + 2000;
    while (Date.now() < deadline) {
      const children = (await readFile(`/proc/${pid}/task/${pid}/children`, 'utf8')).trim();
      if (children) {
        const writerStatus = await readFile(`/proc/${children.split(' ')[0]}/status`, 'utf8');
        if (/^Name:\s+di-bag-ready$/m.test(writerStatus)) break;
      }
      await pause();
    }
    throw new Error('status read failed with open pipes');
  });
  expect(result).toMatchObject({ terminationReason: 'monitor', signal: 'SIGKILL',
    stdout: 'writer ready\nafter exit out\n', stderr: 'after exit err\n' });
  expect(() => process.kill(parent, 0)).toThrow();
});

test('supervisor retains clean child streams and exit status', async () => {
  expect((await child("console.log(process.versions.bun ? 'bun' : 'node')")).stdout).toBe('node\n');
  expect(await child("console.log('out'); console.error('err')")).toMatchObject({ status: 0, signal: null, stdout: 'out\n', stderr: 'err\n' });
  expect(await child('process.exit(3)')).toMatchObject({ status: 3, signal: null });
});
test('failed spawn is explicit evidence', async () => {
  expect(await supervise('/nonexistent-di-bag-compiler', [], process.cwd(), limits)).toMatchObject({ terminationReason: 'spawn', status: null });
});
for (const [reason, changes, source] of [
  ['timeout', { timeoutMilliseconds: 20 }, 'setInterval(() => {}, 1000)'],
  ['memory', { maxRssMiB: 8 }, 'console.log(process.pid); setInterval(() => {}, 1000)'],
  ['output', { maxOutputBytes: 1024 }, "console.log(process.pid); process.stdout.write('x'.repeat(100000)); setInterval(() => {}, 1000)"],
] as const) {
  test(`supervisor terminates and reaps ${reason} child`, async () => {
    const result = await child(source, changes);
    expect(result.terminationReason).toBe(reason);
    expect(result.signal).toBe('SIGKILL');
    expect(Buffer.byteLength(result.stdout) + Buffer.byteLength(result.stderr)).toBeLessThanOrEqual(changes.maxOutputBytes ?? 4096);
    const pid = Number(result.stdout.split('\n')[0]);
    if (Number.isInteger(pid) && pid > 0) expect(() => process.kill(pid, 0)).toThrow();
    expect(result.milliseconds).toBeLessThan(3000);
  });
}
test('invalid limits and unsupported platforms fail before spawning', () => {
  for (const key of Object.keys(limits)) for (const value of [0, -1, Infinity, NaN]) {
    expect(() => validateLimits({ ...limits, [key]: value }, 'linux')).toThrow();
  }
  expect(() => validateLimits(limits, 'darwin')).toThrow('Linux');
});
test('output overflow remains byte bounded when UTF8 is cut within a character', async () => {
  const result = await child("process.stdout.write('🙂'.repeat(1000)); setInterval(() => {}, 1000)", { maxOutputBytes: 1025 });
  expect(result.terminationReason).toBe('output');
  expect(Buffer.byteLength(result.stdout) + Buffer.byteLength(result.stderr)).toBeLessThanOrEqual(1025);
});
