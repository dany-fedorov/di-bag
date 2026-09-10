"""Repeat the two original classic audit controls, retaining failure output."""
import fcntl
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import time

root = Path.cwd()
out = root / 'docs/benchmarks/results/2026-09-10-integration/compiler-spotchecks'
expected = '079b0013a19667247257509407704597a7ab3221'

def hashes(directory):
    return {str(p.relative_to(directory)): hashlib.sha256(p.read_bytes()).hexdigest()
            for p in sorted(directory.rglob('*')) if p.is_file()}

def head():
    return subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip()

with open('/tmp/di-bag-compiler-heavy.lock', 'a') as lock:
    fcntl.flock(lock, fcntl.LOCK_EX)
    assert head() == expected
    source = hashes(root / 'src')
    out.mkdir(exist_ok=False)
    shutil.copyfile(__file__, out / 'collector.py')
    rows = []
    for form in ['chained', 'grouped']:
        argv = ['timeout', '30s', 'node', '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',
                '--max-old-space-size=1024', 'scripts/benchmark-types.ts',
                '--worker', '1000', form, 'valid']
        start = time.monotonic()
        run = subprocess.run(argv, text=True, capture_output=True)
        row = {'argv': argv, 'cwd': str(root), 'status': run.returncode,
               'stdout': run.stdout, 'stderr': run.stderr,
               'seconds': time.monotonic() - start, 'timeout': run.returncode == 124}
        rows.append(row)
        print(json.dumps(row), flush=True)
    (out / 'commands.jsonl').write_text(''.join(json.dumps(row) + '\n' for row in rows))
    assert head() == expected and hashes(root / 'src') == source
    manifest = {'commit': expected, 'source': source, 'sourceUnchanged': True,
                'defaultStack': True, 'oldSpaceMiB': 1024, 'deadlineSeconds': 30,
                'files': hashes(out), 'status': 'collected'}
    (out / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
