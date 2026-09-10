"""Run final gates and explanatory/original evidence serially, without source edits."""
import json, subprocess
from pathlib import Path
root=Path(__file__).resolve().parents[4]
base=Path(__file__).resolve().parent
prefix=['python3',str(base/'gates.py')]
subprocess.run(prefix,cwd=root,check=True)
assert all(json.loads(s)['status']==0 for s in (base/'gates/commands.jsonl').read_text().splitlines()), 'required gate failed'
subprocess.run(['python3',str(base/'controls.py')],cwd=root,check=True)
subprocess.run(['python3',str(base/'collect.py'),'final-matrix','full'],cwd=root,check=True)
subprocess.run(['python3',str(base/'collect.py'),'final-repeats',
 'classic:100:chained:valid','native:100:chained:valid',
 'classic:100:bindings:valid','native:100:bindings:valid',
 'classic:500:chained:valid','native:500:chained:valid'],cwd=root,check=True)
