"""Inventory retained integration evidence; this does not rerun measurements."""
import hashlib
import json
from pathlib import Path

out = Path(__file__).resolve().parent
root = out.parents[3]
target = out / 'artifact-manifest.json'
paths = [p for directory in [out, out.parent / '2026-09-10-e0b28de']
         for p in directory.rglob('*') if p.is_file() and p != target]
paths += [root / 'docs/reports/2026-09-10-performance-completion.md',
          root / 'docs/superpowers/plans/2026-09-10-performance-completion.md']
files = {str(p.relative_to(root)): hashlib.sha256(p.read_bytes()).hexdigest()
         for p in sorted(paths)}
target.write_text(json.dumps({'measuredProductionCommit':
    '079b0013a19667247257509407704597a7ab3221', 'files': files}, indent=2) + '\n')
print(f'Inventoried {len(files)} files.')
