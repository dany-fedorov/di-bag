from pathlib import Path
import fcntl, json, subprocess
out = Path('/tmp/di-bag-classic-depth-probe')
with open('/tmp/di-bag-compiler-heavy.lock', 'a') as lock:
    fcntl.flock(lock, fcntl.LOCK_EX)
    with (out / 'imported-controls.jsonl').open('w') as rows:
        for kind in ['imported-class', 'imported-any']:
            for form in ['chained', 'replacement']:
                for count in [500, 1000]:
                    command = ['node', '--max-old-space-size=3072', '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', str(out / 'imported-controls.mjs'), kind, form, str(count)]
                    run = subprocess.run(command, cwd='/tmp/di-bag-replacement-spike', capture_output=True, text=True, timeout=60)
                    label = f'{kind}-{form}-{count}'
                    (out / (label + '.stdout.log')).write_text(run.stdout)
                    (out / (label + '.stderr.log')).write_text(run.stderr)
                    evidence = json.loads(run.stdout)
                    row = {'command': command, 'status': run.returncode, 'evidence': evidence}
                    rows.write(json.dumps(row) + '\n'); rows.flush()
                    print(json.dumps({'case': label, 'status': run.returncode, 'accepted': evidence['accepted'], 'error': evidence.get('error'), 'milliseconds': evidence['milliseconds']}), flush=True)
