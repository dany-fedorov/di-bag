import subprocess,json,fcntl
from pathlib import Path
root=Path('/tmp/di-bag-replacement-spike');rows=[]
with open('/tmp/di-bag-compiler-heavy.lock','a') as lock:
 fcntl.flock(lock,fcntl.LOCK_EX)
 for name,args in [('work',['tests/incremental-scale.test.ts']),('native-large',['tests/native-compiler.test.ts','--test-name-pattern','native compiler completes 1000'])]:
  cmd=['/tmp/di-bag-bun-1.4.0/bun-linux-x64/bun','test',*args];log=Path('/tmp/di-bag-completion-projection-'+name+'-red.log')
  with log.open('w') as output:r=subprocess.run(cmd,cwd=root,stdout=output,stderr=subprocess.STDOUT)
  rows.append({'name':name,'argv':cmd,'status':r.returncode,'log':str(log)});print(json.dumps(rows[-1]),flush=True)
 Path('/tmp/di-bag-completion-projection-red.json').write_text(json.dumps(rows,indent=2)+'\n')
 assert all(r['status']==1 for r in rows),rows
