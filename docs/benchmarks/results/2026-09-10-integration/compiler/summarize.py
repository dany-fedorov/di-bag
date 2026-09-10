"""Verify final compiler identities and compare with the retained Task 3 baseline."""
import hashlib
import itertools
import json
from pathlib import Path

out = Path(__file__).resolve().parent
base = out.parent.parent / '2026-09-10-compiler-performance/before'
previous = out.parent.parent / '2026-09-10-compiler-performance/final-matrix'

def read_rows(path):
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]

def key(row):
    return tuple(row[k] for k in ['count', 'form', 'lane', 'scenario'])

def work(row):
    return row.get('instantiations', row.get('metrics', {}).get('Instantiations'))

def failure(row):
    if row['accepted']:
        return None
    if 'RangeError' in row.get('stderr', ''):
        return 'RangeError in type instantiation'
    return row.get('terminationReason') or row.get('failureReason')

manifest = json.loads((out / 'manifest.json').read_text())
before_manifest = json.loads((base / 'manifest.json').read_text())
assert manifest['status'] == 'complete' and manifest['rows'] == 24
assert manifest['source'] == manifest['sourceAfter']
assert manifest['commit'] == manifest['commitAfter']
assert manifest['compilerPackageHashes'] == before_manifest['compilerPackageHashes']
assert manifest['generatorAndHarnessHashes'] == before_manifest['generatorAndHarnessHashes']
assert {str(p.relative_to(out / 'src')): hashlib.sha256(p.read_bytes()).hexdigest()
        for p in sorted((out / 'src').rglob('*')) if p.is_file()} == manifest['source']
rows = read_rows(out / 'rows.jsonl')
commands = read_rows(out / 'commands.jsonl')
before = {key(row): row for row in read_rows(base / 'rows.jsonl')}
previous_rows = {key(row): row for row in read_rows(previous / 'rows.jsonl')}
expected = set(itertools.product([100, 500, 1000], manifest['forms'], manifest['lanes'], ['valid']))
assert len(rows) == len(commands) == len(before) == 24 and {key(r) for r in rows} == expected
comparisons = []
for row, command in zip(rows, commands):
    assert json.loads(command['stdout']) == row and not command['outerTimeout']
    assert command['status'] == (0 if row['accepted'] else 1)
    assert row['sourceCommitBefore'] == row['sourceCommitAfter'] == manifest['commit']
    assert row['sourceSha256Before'] == row['sourceSha256After'] == row['sourceSha256']
    assert not row['sourceDirty'] and row['sourceStatusBefore'] == row['sourceStatusAfter'] == ''
    old = before[key(row)]
    prior = previous_rows[key(row)]
    assert row['generatedSha256Before'] == row['generatedSha256After'] == old['generatedSha256'] == prior['generatedSha256']
    current_work, old_work = work(row), work(old)
    comparisons.append({
        **{k: row[k] for k in ['lane', 'count', 'form', 'scenario']},
        'beforeAccepted': old['accepted'], 'finalAccepted': row['accepted'],
        'beforeInstantiations': old_work, 'finalInstantiations': current_work,
        'changePercent': (current_work / old_work - 1) * 100 if current_work and old_work else None,
        'previousTask3Instantiations': work(prior),
        'finalFailure': failure(row),
        'finalMilliseconds': row.get('milliseconds'),
        'finalRssMiB': row.get('maxRssMiB', row.get('peakObservedRssMiB')),
        'finalDiagnosticCodes': row.get('codes', [d.get('code') for d in row.get('diagnostics', [])]),
    })
result = {'commit': manifest['commit'], 'sourceSha256': rows[0]['sourceSha256'],
          'beforeCommit': before_manifest['commit'], 'rows': len(rows),
          'accepted': sum(r['accepted'] for r in rows),
          'failed': sum(not r['accepted'] for r in rows),
          'toolHarnessGeneratorSourceAndRowIdentitiesVerified': True,
          'comparisons': comparisons}
(out / 'summary.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result, indent=2))
