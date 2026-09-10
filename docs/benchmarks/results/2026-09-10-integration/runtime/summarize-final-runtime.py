"""Derive tables from complete original-workload observations; keep failures."""
import argparse
import collections
import json
from pathlib import Path
import statistics

parser = argparse.ArgumentParser()
parser.add_argument('directory')
args = parser.parse_args()
out = Path(args.directory)
manifest = json.loads((out/'manifest.json').read_text())
assert manifest['status'] == 'collected' and manifest['rows'] == 141
rows = [json.loads(line) for line in (out/'rows.jsonl').read_text().splitlines() if line.strip()]
assert len(rows) == 141
fields = {
    'close-flat': ['elapsedMs'], 'close-deep': ['elapsedMs', 'disposed', 'disposedAfterSecondClose'],
    'transient-memory': ['retainedHeapBytes', 'retainedAcquisitions', 'closeMs', 'afterCloseHeapBytes'],
    'warm-proxy': ['proxyMs', 'directMs'], 'scope-override': ['plainMs', 'overrideMs'],
    'cold-chain': ['elapsedMs', 'created', 'value'],
    'module-install': ['installMs', 'retainedHeapBytes'],
    'build-incremental': ['incrementalMs', 'bulkMs', 'retainedHeapBytes'],
    'replace-history': ['incrementalMs', 'retainedHeapBytes'],
}
groups = collections.defaultdict(list)
for row in rows:
    groups[(row['build'], row['scenario'], row['count'])].append(row)
summary = []
for (build, scenario, count), group in sorted(groups.items()):
    accepted = [r['observation'] for r in group if r['accepted']]
    values = {field: statistics.median(r[field] for r in accepted if field in r)
              for field in fields[scenario] if any(field in r for r in accepted)}
    summary.append({'build': build, 'scenario': scenario, 'count': count,
                    'rows': len(group), 'accepted': len(accepted),
                    'medianOfAcceptedOnly': values,
                    'failures': [r for r in group if not r['accepted']]})
assert sum(r['rows'] for r in summary) == 141
(out/'summary.json').write_text(json.dumps(summary, indent=2)+'\n')
for scenario in fields:
    count = max(r['count'] for r in summary if r['scenario'] == scenario and (scenario != 'cold-chain' or r['count'] <= 1000))
    print(json.dumps({'scenario': scenario, 'count': count,
                      'observations': [r for r in summary if r['scenario'] == scenario and r['count'] == count]}))
