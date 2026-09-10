from pathlib import Path
import subprocess,time,json,fcntl,sys
root=Path('/tmp/di-bag-replacement-spike');prefix=Path('/tmp/di-bag-builder-keys')
steps=[('package-green',['/tmp/di-bag-bun-1.4.0/bun-linux-x64/bun','test','tests/package.test.ts','tests/token-package.test.ts','tests/native-package.test.ts']),('classic-typecheck',['npm','run','typecheck']),('native-typecheck',['npm','run','typecheck:native']),('native-audit',['npm','run','check:native']),('docs-generate',['npm','run','docs:generate']),('docs-check',['npm','run','docs:check'])]
rows=[]
with open('/tmp/di-bag-compiler-heavy.lock','a') as lock:
 fcntl.flock(lock,fcntl.LOCK_EX)
 for name,argv in steps:
  log=Path(str(prefix)+'-'+name+'.log');started=time.monotonic()
  with log.open('w') as output:r=subprocess.run(argv,cwd=root,stdout=output,stderr=subprocess.STDOUT)
  row={'step':name,'argv':argv,'status':r.returncode,'seconds':time.monotonic()-started,'log':str(log)};rows.append(row)
  Path(str(prefix)+'-verification.json').write_text(json.dumps(rows,indent=2)+'\n');print(json.dumps(row),flush=True)
  if r.returncode:sys.exit(r.returncode)
