"""Build the frozen integration commit and rerun every original runtime audit row.

Run only after scoped reviews, with no other timed workload active. This records
observations, including failures; successful collection is not a passing audit.
"""
import argparse
import fcntl
import hashlib
import json
import os
from pathlib import Path
import platform
import shutil
import signal
import subprocess
import time

parser = argparse.ArgumentParser()
parser.add_argument('expected_commit')
parser.add_argument('output')
parser.add_argument('--root', default='/tmp/di-bag-performance-integration')
parser.add_argument('--baseline', default='/tmp/di-bag-performance-original-main')
args = parser.parse_args()
root = Path(args.root).resolve()
baseline = Path(args.baseline).resolve()
out = Path(args.output).resolve()
audit = root / 'docs/benchmarks/results/2026-09-10-da6ec93'
base_commit = 'da6ec93ad13ce457e07318138bd0e1c080e19eb7'
expected_probe = '5959566e060ca72bb9947e0c0898b016abd54f70d3cc9bf1c3cf198aac2071a3'


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def hashes(directory):
    return {str(p.relative_to(directory)): sha(p)
            for p in sorted(directory.rglob('*')) if p.is_file()}


def git(*argv):
    return subprocess.check_output(['git', *argv], cwd=root, text=True).strip()


def write_json(path, value):
    path.write_text(json.dumps(value, indent=2) + '\n')


def capture(argv, cwd, seconds):
    started = time.monotonic()
    child = subprocess.Popen(argv, cwd=cwd, stdout=subprocess.PIPE,
                             stderr=subprocess.PIPE, text=True,
                             start_new_session=True)
    timeout = False
    try:
        stdout, stderr = child.communicate(timeout=seconds)
    except subprocess.TimeoutExpired:
        timeout = True
        os.killpg(child.pid, signal.SIGKILL)
        stdout, stderr = child.communicate()
    return {'argv': argv, 'cwd': str(cwd), 'status': child.returncode,
            'stdout': stdout, 'stderr': stderr, 'timeout': timeout,
            'deadlineSeconds': seconds,
            'elapsedSeconds': time.monotonic() - started}


with open('/tmp/di-bag-compiler-heavy.lock', 'a') as lock:
    fcntl.flock(lock, fcntl.LOCK_EX)
    assert git('rev-parse', 'HEAD') == args.expected_commit
    assert not git('status', '--porcelain', '--', 'src', 'package.json',
                   'package-lock.json', 'tsconfig.json', 'tsconfig.build.json')
    assert sha(audit / 'probe.mjs') == expected_probe
    original_manifest = json.loads((audit / 'manifest.json').read_text())
    assert hashes(baseline / 'src') == original_manifest['src']['files']
    original_js = {k: v for k, v in hashes(baseline / 'dist').items() if k.endswith('.js')}
    assert original_js == original_manifest['dist']['files']
    for relative, digest in original_manifest['src']['files'].items():
        content = subprocess.check_output(['git', 'show', f'{base_commit}:src/{relative}'], cwd=root)
        assert hashlib.sha256(content).hexdigest() == digest
    original_rows = [json.loads(s) for s in (audit / 'runtime.jsonl').read_text().splitlines() if s.strip()]
    workloads = [{k: r[k] for k in ('scenario', 'count', 'sample')} for r in original_rows]
    assert len(workloads) == 47
    out.mkdir(parents=True, exist_ok=False)
    shutil.copyfile(audit / 'probe.mjs', out / 'probe.mjs')
    shutil.copyfile(Path(__file__), out / 'collect-final-runtime.py')
    shutil.copytree(root / 'src', out / 'source')
    before = hashes(root / 'src')
    manifest = {
        'status': 'building', 'commit': args.expected_commit, 'baselineCommit': base_commit,
        'source': before, 'baselineSource': hashes(baseline / 'src'),
        'baselineDist': hashes(baseline / 'dist'), 'probeSha256': expected_probe,
        'node': subprocess.check_output(['node', '--version'], text=True).strip(),
        'bun': subprocess.check_output(['bun', '--version'], text=True).strip(),
        'platform': platform.platform(), 'defaultStack': True,
        'runtimeOldSpaceMiB': 512, 'runtimeChildTimeoutSeconds': 30,
        'workloads': workloads, 'rowsPerBuild': 47,
        'compilerPackages': {name: hashes(root / 'node_modules' / name) for name in
            ['typescript', '@typescript/old', '@typescript/native', '@typescript/typescript-linux-x64']},
        'buildInputs': {name: sha(root / name) for name in
                        ['package.json', 'package-lock.json', 'tsconfig.json', 'tsconfig.build.json']},
        'note': 'Original-classic versus final-classic is the paired comparison. Final-native is a second-emitter control. Failures remain observations, not accepted performance results.'
    }
    write_json(out / 'manifest.json', manifest)
    for lane, script in [('classic', 'build'), ('native', 'build:native')]:
        command = capture(['npm', 'run', script], root, 120)
        write_json(out / f'build-{lane}.json', command)
        assert command['status'] == 0 and not command['timeout'], command
        shutil.copytree(root / 'dist', out / 'builds' / lane)
    builds = [('original-classic', baseline / 'dist'),
              ('final-classic', out / 'builds/classic'),
              ('final-native', out / 'builds/native')]
    manifest['builds'] = {label: {'path': str(path), 'hashes': hashes(path)} for label, path in builds}
    manifest['status'] = 'measuring'
    write_json(out / 'manifest.json', manifest)
    records = []
    with (out / 'commands.jsonl').open('w') as commands, (out / 'rows.jsonl').open('w') as rows:
        for label, dist in builds:
            for work in workloads:
                argv = ['node', '--expose-gc', '--max-old-space-size=512', str(out / 'probe.mjs'),
                        str(dist / 'node.js'), work['scenario'], str(work['count']), str(work['sample'])]
                command = capture(argv, root, 30)
                command.update({'build': label, **work})
                commands.write(json.dumps(command) + '\n')
                commands.flush()
                result = {'build': label, **work, 'processStatus': command['status'],
                          'timeout': command['timeout']}
                try:
                    observation = json.loads(command['stdout'])
                    assert isinstance(observation, dict)
                    assert all(observation[k] == v for k, v in work.items())
                    result['observation'] = observation
                    result['accepted'] = command['status'] == 0 and not command['timeout'] and not command['stderr'] and not observation.get('error')
                    if work['scenario'] == 'cold-chain':
                        result['accepted'] &= observation.get('value') == work['count'] and observation.get('created') == work['count']
                    if work['scenario'] == 'close-deep':
                        result['accepted'] &= observation.get('disposed') == work['count'] and observation.get('disposedAfterSecondClose') == work['count'] and observation.get('afterCloseAcquisitions') == 0
                except (ValueError, KeyError, AssertionError, TypeError) as error:
                    result.update({'accepted': False, 'collectorParseError': str(error)})
                rows.write(json.dumps(result) + '\n')
                rows.flush()
                records.append(result)
                print(json.dumps({k: result[k] for k in ('build', 'scenario', 'count', 'sample', 'accepted')}), flush=True)
    manifest['sourceAfter'] = hashes(root / 'src')
    manifest['commitAfter'] = git('rev-parse', 'HEAD')
    manifest['sourceUnchanged'] = before == manifest['sourceAfter']
    manifest['buildsUnchanged'] = all(hashes(path) == manifest['builds'][label]['hashes'] for label, path in builds)
    manifest['status'] = 'collected'
    manifest['rows'] = len(records)
    manifest['acceptedByBuild'] = {label: sum(r['accepted'] for r in records if r['build'] == label) for label, _ in builds}
    write_json(out / 'manifest.json', manifest)
    assert manifest['sourceUnchanged'] and manifest['buildsUnchanged']
    assert manifest['commitAfter'] == args.expected_commit and len(records) == 141
