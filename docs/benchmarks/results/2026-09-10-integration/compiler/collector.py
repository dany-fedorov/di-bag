"""Collect selected original compiler cases on the frozen integration commit; never drop failures."""
import argparse
import fcntl
import hashlib
import json
import os
from pathlib import Path
import shutil
import signal
import subprocess
import time

parser = argparse.ArgumentParser()
parser.add_argument('expected_commit')
parser.add_argument('output')
args = parser.parse_args()
root = Path.cwd().resolve()
out = Path(args.output).resolve()
out.mkdir(parents=True, exist_ok=False)

def git(*argv):
    return subprocess.check_output(['git', *argv], cwd=root, text=True).strip()

def hashes(directory):
    return {str(p.relative_to(directory)): hashlib.sha256(p.read_bytes()).hexdigest()
            for p in sorted(directory.rglob('*')) if p.is_file()}

with open('/tmp/di-bag-compiler-heavy.lock', 'a') as lock:
    fcntl.flock(lock, fcntl.LOCK_EX)
    assert git('rev-parse', 'HEAD') == args.expected_commit
    assert not git('status', '--porcelain', '--', 'src')
    shutil.copytree(root / 'src', out / 'src')
    shutil.copyfile(Path(__file__), out / 'collector.py')
    before = hashes(root / 'src')
    manifest = {
        'status': 'running', 'commit': args.expected_commit, 'source': before,
        'collectorSha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        'node': subprocess.check_output(['node', '--version'], text=True).strip(),
        'compilerPackageHashes': {
            name: hashes(root / 'node_modules' / name)
            for name in ['typescript', '@typescript/old', '@typescript/native',
                         '@typescript/typescript-linux-x64']
        },
        'generatorAndHarnessHashes': {
            name: hashlib.sha256((root / name).read_bytes()).hexdigest()
            for name in ['tests/compiler.ts', 'scripts/compiler-case.ts',
                         'scripts/check-compiler-case.ts', 'scripts/benchmark-types.ts',
                         'scripts/check-token-scale.ts', 'scripts/native-scale.ts',
                         'scripts/native-compiler.ts', 'scripts/native-process.ts',
                         'scripts/benchmark-result.ts', 'package-lock.json']
        },
        'forms': ['chained', 'replacement', 'bindings', 'modules'],
        'counts': [100, 500, 1000], 'lanes': ['classic', 'native'],
        'scenario': 'valid', 'innerWorkerSeconds': 60,
        'innerWorkerMiB': 3072, 'innerOutputBytes': 4194304,
        'outerCollectorSeconds': 100, 'defaultStack': True,
        'note': 'Final integration selected valid controls, paired with Task3 fresh before rows. The complete108 matrix is separately retained at the unchanged type-helper revision; this24-row collection does not relabel that earlier source.',
    }
    (out / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    with (out / 'commands.jsonl').open('w') as commands, (out / 'rows.jsonl').open('w') as rows:
        for count in manifest['counts']:
            for form in manifest['forms']:
                for lane in manifest['lanes']:
                    argv = ['node', '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',
                            'scripts/check-compiler-case.ts', lane, str(count), form, 'valid']
                    started = time.monotonic()
                    child = subprocess.Popen(argv, cwd=root, stdout=subprocess.PIPE,
                                             stderr=subprocess.PIPE, text=True,
                                             start_new_session=True)
                    outer_timeout = False
                    try:
                        stdout, stderr = child.communicate(timeout=100)
                    except subprocess.TimeoutExpired:
                        outer_timeout = True
                        os.killpg(child.pid, signal.SIGKILL)
                        stdout, stderr = child.communicate()
                    command = {'argv': argv, 'cwd': str(root), 'status': child.returncode,
                               'stdout': stdout, 'stderr': stderr,
                               'outerTimeout': outer_timeout,
                               'elapsedSeconds': time.monotonic() - started}
                    commands.write(json.dumps(command) + '\n')
                    commands.flush()
                    try:
                        row = json.loads(stdout)
                        assert isinstance(row, dict)
                    except (ValueError, AssertionError) as error:
                        row = {'lane': lane, 'count': count, 'form': form, 'scenario': 'valid',
                               'accepted': False, 'collectorParseError': str(error),
                               'outerTimeout': outer_timeout, 'status': child.returncode}
                    rows.write(json.dumps(row) + '\n')
                    rows.flush()
                    print(json.dumps({'lane': lane, 'count': count, 'form': form,
                                      'accepted': row.get('accepted'),
                                      'instantiations': row.get('instantiations', row.get('metrics', {}).get('Instantiations')),
                                      'elapsedSeconds': round(command['elapsedSeconds'], 2),
                                      'failureReason': row.get('failureReason')}), flush=True)
    manifest['sourceAfter'] = hashes(root / 'src')
    manifest['commitAfter'] = git('rev-parse', 'HEAD')
    manifest['sourceUnchanged'] = before == manifest['sourceAfter']
    manifest['status'] = 'complete'
    manifest['rows'] = len((out / 'rows.jsonl').read_text().splitlines())
    (out / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    assert manifest['sourceUnchanged']
    assert manifest['commitAfter'] == args.expected_commit
    assert manifest['rows'] == 24
