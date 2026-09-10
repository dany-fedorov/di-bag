import subprocess,json,fcntl
from pathlib import Path
out=Path('/tmp/di-bag-empty-dependency-probe');rows=[]
with open('/tmp/di-bag-compiler-heavy.lock','a') as lock:
 fcntl.flock(lock,fcntl.LOCK_EX)
 for lane,variant,count,form in [('classic','baseline',500,'bindings'),('classic','cached-with-new-shortcuts',500,'bindings'),('native','cached-with-new-shortcuts',1000,'bindings')]:
  worker='worker.mjs' if lane=='classic' else 'native-worker.mjs'
  cmd=['node','--max-old-space-size=3072','--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',str(out/worker),variant,str(count),form]
  name=f'{variant}-{lane}-{count}-{form}'
  p=subprocess.run(cmd,cwd='/tmp/di-bag-replacement-spike',capture_output=True,text=True,timeout=75)
  (out/(name+'.stdout.log')).write_text(p.stdout);(out/(name+'.stderr.log')).write_text(p.stderr)
  row={'lane':lane,'variant':variant,'count':count,'form':form,'status':p.returncode,'argv':cmd,'result':json.loads(p.stdout) if p.stdout.startswith('{') else None};rows.append(row);print(json.dumps(row),flush=True)
 (out/'scale-rows.json').write_text(json.dumps(rows,indent=2)+'\n')
