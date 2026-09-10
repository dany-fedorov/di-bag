"""Serialize required contract, package and build gates and retain exact output."""
import fcntl, json, subprocess, time
from pathlib import Path
root=Path(__file__).resolve().parents[4];out=Path(__file__).resolve().parent/'gates';out.mkdir(exist_ok=False)
cases=[
 ('typecheck-classic',['npm','run','typecheck']),
 ('typecheck-native',['npm','run','typecheck:native']),
 ('build-classic',['npm','run','build']),
 ('build-native',['npm','run','build:native']),
 ('native-audit',['npm','run','check:native']),
 ('packages',['bun','test','tests/package.test.ts','tests/box-package.test.ts','tests/token-package.test.ts','tests/native-package.test.ts','tests/lifetime-declarations.test.ts']),
 ('scale-contracts',['bun','test','tests/type-scale.test.ts','tests/token-scale.test.ts','tests/incremental-scale.test.ts']),
]
with open('/tmp/di-bag-compiler-heavy.lock','a') as lock:
 fcntl.flock(lock,fcntl.LOCK_EX)
 with (out/'commands.jsonl').open('w') as f:
  for name,argv in cases:
   start=time.monotonic();p=subprocess.run(argv,cwd=root,capture_output=True,text=True)
   (out/(name+'.stdout.log')).write_text(p.stdout);(out/(name+'.stderr.log')).write_text(p.stderr)
   row={'name':name,'argv':argv,'cwd':str(root),'status':p.returncode,'seconds':time.monotonic()-start,'stdout':name+'.stdout.log','stderr':name+'.stderr.log'}
   f.write(json.dumps(row)+'\n');f.flush();print(json.dumps(row),flush=True)
