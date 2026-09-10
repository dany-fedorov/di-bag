"""Record full local integration gates on a frozen reviewed commit.

Run only after Task4 scoped review. Serial execution avoids interfering with
measurement workers. Any failed phase stays failed and remains in its logs.
"""
import argparse
import fcntl
import hashlib
import json
import os
from pathlib import Path
import signal
import subprocess
import threading
import time

parser = argparse.ArgumentParser()
parser.add_argument('expected_commit')
parser.add_argument('output')
parser.add_argument('--root', default='/tmp/di-bag-performance-integration')
parser.add_argument('--phases', nargs='+')
parser.add_argument('--sample-rss', action='store_true')
args = parser.parse_args()
root = Path(args.root).resolve()
out = Path(args.output).resolve()


def git(*argv):
    return subprocess.check_output(['git', *argv], cwd=root, text=True).strip()


def hashes(directory):
    return {str(p.relative_to(directory)): hashlib.sha256(p.read_bytes()).hexdigest()
            for p in sorted(directory.rglob('*')) if p.is_file()}


def sample_tree(pid, stop, result):
    """Observe only this command's descendant tree; no command-line/env capture."""
    while not stop.is_set():
        todo, seen, processes = [pid], set(), []
        while todo:
            current = todo.pop()
            if current in seen:
                continue
            seen.add(current)
            proc = Path('/proc') / str(current)
            try:
                status = dict(line.split(':', 1) for line in (proc/'status').read_text().splitlines() if ':' in line)
                rss = int(status.get('VmRSS', '0 kB').split()[0])
                processes.append({'pid': current, 'name': status.get('Name', '').strip(), 'rssKiB': rss})
                for task in (proc/'task').iterdir():
                    try:
                        todo.extend(int(item) for item in (task/'children').read_text().split())
                    except (FileNotFoundError, ProcessLookupError, PermissionError):
                        result['racedOrUnavailableReads'] += 1
            except (FileNotFoundError, ProcessLookupError, PermissionError, ValueError):
                result['racedOrUnavailableReads'] += 1
        result['samples'] += 1
        total = sum(process['rssKiB'] for process in processes)
        if total > result['largestObservedTreeKiB']:
            result['largestObservedTreeKiB'] = total
            result['treeAtObservedPeak'] = processes
        for process in processes:
            if process['rssKiB'] > result['largestObservedProcess'].get('rssKiB', 0):
                result['largestObservedProcess'] = process
        stop.wait(0.5)


with open('/tmp/di-bag-compiler-heavy.lock', 'a') as lock:
    fcntl.flock(lock, fcntl.LOCK_EX)
    assert git('rev-parse', 'HEAD') == args.expected_commit
    assert not git('diff', '--name-only')
    assert not git('diff', '--cached', '--name-only')
    out.mkdir(parents=True, exist_ok=False)
    (out/'recorder.py').write_bytes(Path(__file__).read_bytes())
    original_source = hashes(root / 'src')
    versions = {name: subprocess.check_output([name, '--version'], text=True).strip()
                for name in ('node', 'bun', 'npm')}
    node_regressions = ['node', '--expose-gc', '--test', '--test-isolation=none',
                        'tests/runtime-scale.node.mjs', 'tests/acquisition-retention.node.mjs',
                        'tests/graph-retention.node.mjs']
    phases = [('check-classic', ['npm', 'run', 'check'], 1800),
              ('node-classic', node_regressions, 180),
              ('typecheck-native', ['npm', 'run', 'typecheck:native'], 180),
              ('build-native', ['npm', 'run', 'build:native'], 180),
              ('node-native', node_regressions, 180),
              ('native-audit', ['npm', 'run', 'check:native'], 900),
              ('docs-check', ['npm', 'run', 'docs:check'], 180),
              ('platform-required', ['npm', 'run', 'check:platform'], 300)]
    phases += [(f'example-{p.stem}', ['bun', 'run', str(p.relative_to(root))], 60)
               for p in sorted((root/'examples').glob('*.ts'))]
    if args.phases:
        known = {phase[0] for phase in phases}
        assert set(args.phases) <= known
        phases = [phase for phase in phases if phase[0] in args.phases]
    manifest = {'status': 'running', 'commit': args.expected_commit, 'source': original_source,
                'recorderSha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
                'versions': versions, 'phases': [],
                'note': 'Local complete source/package/Node/type/docs/example/portable gates. Remote CI is tracked separately.'}
    def save():
        (out / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    save()
    for name, argv, limit in phases:
        prerequisite = {'node-classic': 'check-classic', 'node-native': 'build-native'}.get(name)
        if prerequisite and not any(p['name'] == prerequisite and p['status'] == 0 for p in manifest['phases']):
            manifest['phases'].append({'name': name, 'argv': argv, 'status': None, 'timeout': False,
                                       'skipped': f'{prerequisite} did not pass; emitted identity unverified'})
            save()
            continue
        assert git('rev-parse', 'HEAD') == args.expected_commit
        started = time.monotonic()
        print(json.dumps({'phase': name, 'status': 'running'}), flush=True)
        timed_argv = ['/usr/bin/time', '-v', '-o', str(out/f'{name}.time.log'), *argv]
        with (out/f'{name}.stdout.log').open('w') as stdout, (out/f'{name}.stderr.log').open('w') as stderr:
            child = subprocess.Popen(timed_argv, cwd=root, stdout=stdout, stderr=stderr, start_new_session=True)
            timeout = False
            rss = {'intervalSeconds': 0.5, 'note': 'Observed descendant RSS sums, not a guaranteed total-memory maximum. No process limits changed.', 'samples': 0, 'racedOrUnavailableReads': 0, 'largestObservedTreeKiB': 0, 'largestObservedProcess': {}, 'treeAtObservedPeak': []}
            stop = threading.Event()
            monitor = threading.Thread(target=sample_tree, args=(child.pid, stop, rss), daemon=True) if args.sample_rss else None
            if monitor:
                monitor.start()
            try:
                child.wait(timeout=limit)
            except subprocess.TimeoutExpired:
                timeout = True
                os.killpg(child.pid, signal.SIGKILL)
                child.wait()
            finally:
                stop.set()
                if monitor:
                    monitor.join()
        if args.sample_rss:
            (out/f'{name}.rss.json').write_text(json.dumps(rss, indent=2)+'\n')
        phase = {'name': name, 'argv': argv, 'timedArgv': timed_argv, 'cwd': str(root),
                 'status': child.returncode, 'timeout': timeout, 'deadlineSeconds': limit,
                 'elapsedSeconds': time.monotonic()-started,
                 'logs': {suffix: hashlib.sha256((out/f'{name}.{suffix}.log').read_bytes()).hexdigest()
                          for suffix in ('stdout', 'stderr', 'time')}}
        if name in ('check-classic', 'build-native'):
            phase['dist'] = hashes(root/'dist')
        if args.sample_rss:
            phase['rssSha256'] = hashlib.sha256((out/f'{name}.rss.json').read_bytes()).hexdigest()
        manifest['phases'].append(phase)
        save()
        print(json.dumps({k: phase[k] for k in ('name', 'status', 'timeout', 'elapsedSeconds')}), flush=True)
    manifest.update({'status': 'collected', 'sourceAfter': hashes(root/'src'),
                     'commitAfter': git('rev-parse', 'HEAD')})
    manifest['sourceUnchanged'] = original_source == manifest['sourceAfter']
    manifest['allProcessExitsPassed'] = all(p['status'] == 0 and not p['timeout'] for p in manifest['phases'])
    save()
    assert manifest['sourceUnchanged'] and manifest['commitAfter'] == args.expected_commit
    raise SystemExit(0 if manifest['allProcessExitsPassed'] else 1)
