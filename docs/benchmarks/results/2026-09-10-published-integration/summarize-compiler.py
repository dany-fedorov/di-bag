"""Reconcile the current-main baseline and exact merged-candidate compiler rows."""
import hashlib
import itertools
import json
from pathlib import Path
import subprocess

out = Path(__file__).resolve().parent

def read(directory, file):
    return json.loads((out / directory / file).read_text())

def rows(directory, file='rows.jsonl'):
    return [json.loads(line) for line in (out / directory / file).read_text().splitlines() if line.strip()]

def key(row):
    return tuple(row[k] for k in ['count', 'form', 'lane', 'scenario'])

def work(row):
    return row.get('instantiations', row.get('metrics', {}).get('Instantiations'))

def failure(row):
    if row['accepted']:
        return None
    if 'RangeError' in row.get('stderr', ''):
        return 'RangeError in type instantiation'
    if row.get('terminationReason'):
        return row['terminationReason']
    if 'timeout' in row.get('stderr', '').lower():
        return 'timeout'
    if row.get('codes'):
        return 'diagnostics: ' + ','.join(str(code) for code in row['codes'])
    return row.get('failureReason', 'failed')

manifests = {d: read(d, 'manifest.json') for d in ['compiler-before', 'compiler-after']}
before_manifest, after_manifest = manifests.values()
assert before_manifest['compilerPackageHashes'] == after_manifest['compilerPackageHashes']
harness_changes = {name: {'before': digest, 'after': after_manifest['generatorAndHarnessHashes'].get(name)}
                   for name, digest in before_manifest['generatorAndHarnessHashes'].items()
                   if digest != after_manifest['generatorAndHarnessHashes'].get(name)}
assert set(harness_changes) == {'scripts/native-process.ts'}
for name, pair in harness_changes.items():
    for directory, label in [('compiler-before', 'before'), ('compiler-after', 'after')]:
        content = subprocess.check_output(['git', 'show', manifests[directory]['commit'] + ':' + name], cwd=out)
        assert hashlib.sha256(content).hexdigest() == pair[label]
for directory, manifest in manifests.items():
    collected = rows(directory)
    commands = rows(directory, 'commands.jsonl')
    expected = set(itertools.product(manifest['counts'], manifest['forms'], manifest['lanes'], ['valid']))
    assert manifest['status'] == 'complete'
    assert manifest['rows'] == len(collected) == len(commands) == len(expected)
    assert {key(row) for row in collected} == expected
    assert manifest['commit'] == manifest['commitAfter']
    assert manifest['source'] == manifest['sourceAfter']
    src = out / directory / 'src'
    assert {str(p.relative_to(src)): hashlib.sha256(p.read_bytes()).hexdigest()
            for p in sorted(src.rglob('*')) if p.is_file()} == manifest['source']
    for row, command in zip(collected, commands):
        assert json.loads(command['stdout']) == row and not command['outerTimeout']
        assert command['status'] == (0 if row['accepted'] else 1)
        assert row['sourceCommitBefore'] == row['sourceCommitAfter'] == manifest['commit']
        assert row['sourceSha256Before'] == row['sourceSha256After'] == row['sourceSha256']
        assert not row['sourceDirty'] and row['sourceStatusBefore'] == row['sourceStatusAfter'] == ''
        assert row['generatedSha256Before'] == row['generatedSha256After']
before = {key(row): row for row in rows('compiler-before')}
after = rows('compiler-after')
comparisons = []
for row in after:
    old = before.get(key(row))
    if old:
        assert old['generatedSha256'] == row['generatedSha256']
    current_work, old_work = work(row), work(old) if old else None
    comparisons.append({
        **{k: row[k] for k in ['lane', 'count', 'form', 'scenario']},
        'beforeAccepted': old['accepted'] if old else None,
        'finalAccepted': row['accepted'],
        'beforeInstantiations': old_work, 'finalInstantiations': current_work,
        'changePercent': (current_work / old_work - 1) * 100 if current_work and old_work else None,
        'finalFailure': failure(row),
        'finalMilliseconds': row.get('milliseconds'),
        'finalRssMiB': row.get('maxRssMiB', row.get('peakObservedRssMiB')),
    })
summary = {
    'beforeCommit': before_manifest['commit'], 'finalCommit': after_manifest['commit'],
    'beforeRows': len(before), 'finalRows': len(after),
    'beforeAccepted': sum(r['accepted'] for r in before.values()),
    'finalAccepted': sum(r['accepted'] for r in after),
    'verified': 'All rows, commands, source snapshots and compiler packages reconciled. Generators and harnesses match except the separately reviewed supervisor exit-race repair, verified against both exact Git revisions.',
    'harnessChanges': harness_changes,
    'note': 'Current-main paired baselines cover 100/500. The final 1000 rows are explicit acceptance probes; no 1000 current-main paired baseline is claimed. Historical 1000 failures remain in earlier evidence.',
    'comparisons': comparisons,
}
(out / 'compiler-summary.json').write_text(json.dumps(summary, indent=2) + '\n')
print(json.dumps(summary, indent=2))
