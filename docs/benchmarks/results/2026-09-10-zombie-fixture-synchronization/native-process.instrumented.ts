export const trace: unknown[] = [];
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { readFileSync, readdirSync } from 'node:fs';
import { performance } from 'node:perf_hooks';

export type ProcessLimits = { timeoutMilliseconds: number; maxRssMiB: number; maxOutputBytes: number; sampleMilliseconds: number };
export type NativeProcessResult = { status: number | null; signal: string | null; stdout: string; stderr: string; milliseconds: number; peakObservedRssMiB: number; terminationReason?: 'timeout' | 'memory' | 'output' | 'monitor' | 'spawn'; error?: string };
export function validateLimits(limits: ProcessLimits, platform: string = process.platform): void {
  if (platform !== 'linux') throw new Error('Native supervision requires Linux /proc memory monitoring');
  for (const value of [limits.timeoutMilliseconds, limits.maxRssMiB, limits.maxOutputBytes, limits.sampleMilliseconds]) {
    if (!Number.isFinite(value) || value <= 0) throw new Error('Process limits must be positive finite numbers');
  }
}

// /proc stat field 9 exposes PF_EXITING before memory release and State Z.
// comm is unescaped and can contain spaces, newlines and closing parentheses.
export function isExitingTask(stat: string, pid: number): boolean {
  if (!stat.startsWith(`${pid} (`)) return false;
  const close = stat.lastIndexOf(')');
  if (close < `${pid} (`.length || stat[close + 1] !== ' ') return false;
  const fields = stat.slice(close + 2).trim().split(/\s+/);
  if (fields.length < 50 || !/^[RSDZTtWXxKIP]$/.test(fields[0]!) || !/^(0|[1-9]\d*)$/.test(fields[6]!)) return false;
  const flags = Number(fields[6]);
  return Number.isSafeInteger(flags) && flags <= 0xffffffff && (flags & 0x00000004) !== 0;
}

export async function supervise(executable: string, args: readonly string[], cwd: string, limits: ProcessLimits,
  readStatus: (pid: number) => Promise<string> = pid => readFile(`/proc/${pid}/status`, 'utf8')): Promise<NativeProcessResult> {
  validateLimits(limits);
  const start = performance.now();
  return new Promise(resolve => {
    const result: NativeProcessResult = { status: null, signal: null, stdout: '', stderr: '', milliseconds: 0, peakObservedRssMiB: 0 };
    const stdout: Uint8Array[] = [], stderr: Uint8Array[] = [];
    let bytes = 0, exited = false, monitoring = false, missingRss = false;
    let pendingSample: Promise<void> | undefined;
    const child = spawn(executable, [...args], { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    const stop = (reason: NonNullable<NativeProcessResult['terminationReason']>, error?: string) => {
      if (!result.terminationReason) {
        result.terminationReason = reason;
        if (error !== undefined) result.error = error;
      }
      if (!exited) child.kill('SIGKILL');
    };
    const collect = (chunks: Uint8Array[], chunk: Buffer) => {
      const remaining = Math.max(0, Math.floor(limits.maxOutputBytes) - bytes);
      const retained = chunk.subarray(0, remaining);
      if (retained.length) chunks.push(new Uint8Array(retained));
      bytes += retained.length;
      if (chunk.length > remaining) stop('output');
    };
    const onStdout = (chunk: Buffer) => collect(stdout, chunk);
    const onStderr = (chunk: Buffer) => collect(stderr, chunk);
    child.stdout.on('data', onStdout); child.stderr.on('data', onStderr);
    child.once('error', error => stop('spawn', error.message));
    child.once('exit', () => { exited = true; });
    const timeout = setTimeout(() => stop('timeout'), limits.timeoutMilliseconds);
    const hasExited = (pid: number): boolean => {
      if (exited) return true;
      // PF_EXITING is irreversible but belongs to one task. Prove shutdown
      // for every remaining thread, including when the leader is already Z.
      try {
        trace.push({event:'pid-probe',pid}); process.kill(pid, 0); trace.push({event:'pid-present',pid});
        try {
          const directory = `/proc/${pid}/task`;
          const tasks = readdirSync(directory), proven = new Set<string>();
          trace.push({event: "initial-tasks", pid, tasks}); if (!tasks.includes(String(pid))) { trace.push({event:"missing-leader",pid}); return false; }
          for (const task of tasks) {
            if (!/^[1-9]\d*$/.test(task)) { trace.push({event:'invalid-task',pid,task}); return false; }
            try {
              const stat = readFileSync(`${directory}/${task}/stat`, 'utf8'); const exiting = isExitingTask(stat, Number(task)); trace.push({event:'task-stat',pid,task,stat,exiting}); if (!exiting) return false;
              proven.add(task);
            } catch (error) {
              // A departing thread can disappear between listing and reading.
              // The final listing must independently confirm its absence.
              const code = (error as NodeJS.ErrnoException).code;
              trace.push({event:'task-read-error',pid,task,code}); if (code !== 'ENOENT' && code !== 'ESRCH') throw error;
            }
          }
          const remaining = readdirSync(directory); trace.push({event:'remaining-tasks',pid,remaining,proven:[...proven]});
          return proven.has(String(pid)) && remaining.includes(String(pid)) && remaining.every(task => proven.has(task));
        } catch (error) { trace.push({event:'group-read-error',pid,error:String(error)});
          // An unreadable group is not proof. Only ESRCH from a fresh PID probe
          // confirms disappearance; permissions and malformed data fail closed.
          trace.push({event:'pid-probe',pid}); process.kill(pid, 0); trace.push({event:'pid-present',pid});
          return false;
        }
      } catch (probe) {
        trace.push({event:'pid-probe-error',pid,error:String(probe)}); return (probe as NodeJS.ErrnoException).code === 'ESRCH';
      }
    };
    const sample = async () => {
      if (monitoring || exited || !child.pid || result.terminationReason) return;
      monitoring = true;
      try {
        const status = await readStatus(child.pid);
        const rss = /^VmRSS:\s+(\d+)\s+kB$/m.exec(status);
        if (!rss) {
          // During exit /proc may retain the process header after releasing its memory map.
          // A still-live process without VmRSS on the next sample is a monitor failure.
          if (missingRss && !hasExited(child.pid)) stop('monitor', 'VmRSS is missing');
          missingRss = true;
        } else {
          missingRss = false;
          result.peakObservedRssMiB = Math.max(result.peakObservedRssMiB, Number(rss[1]) / 1024);
          if (result.peakObservedRssMiB > limits.maxRssMiB) stop('memory');
        }
      } catch (error) {
        // A disappearing /proc path reports ENOENT; an already-open descriptor
        // can report ESRCH before the exit callback.
        const code = (error as NodeJS.ErrnoException).code;
        if (code === 'ENOENT' || code === 'ESRCH') {
          if (!hasExited(child.pid)) stop('monitor', String(error));
        } else if (!exited) stop('monitor', String(error));
      } finally { monitoring = false; }
    };
    const startSample = () => { if (!monitoring) pendingSample = sample(); };
    const interval = setInterval(startSample, limits.sampleMilliseconds);
    child.once('spawn', startSample);
    child.once('close', async (status, signal) => {
      exited = true; clearTimeout(timeout); clearInterval(interval);
      child.stdout.removeListener('data', onStdout); child.stderr.removeListener('data', onStderr);
      await pendingSample;
      result.status = result.terminationReason === 'spawn' ? null : status;
      result.signal = signal;
      const decode = (chunks: Uint8Array[]) => {
        const buffer = Buffer.concat(chunks), text = buffer.toString('utf8');
        if (Buffer.byteLength(text) <= buffer.length) return text;
        // Decoding a truncated or invalid sequence can expand it into U+FFFD.
        let size = 0, end = 0;
        for (const character of text) {
          size += Buffer.byteLength(character);
          if (size > buffer.length) break;
          end += character.length;
        }
        return text.slice(0, end);
      };
      result.stdout = decode(stdout); result.stderr = decode(stderr);
      result.milliseconds = Math.round(performance.now() - start);
      resolve(result);
    });
  });
}
