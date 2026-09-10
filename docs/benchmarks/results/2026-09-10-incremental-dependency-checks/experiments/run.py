import subprocess,json,fcntl
from pathlib import Path
out=Path('/tmp/di-bag-empty-dependency-probe');rows=[]
with open('/tmp/di-bag-compiler-heavy.lock','a') as lock:
 fcntl.flock(lock,fcntl.LOCK_EX)
 for variant in ('baseline','new-empty','old-empty','disjoint-tokens','empty-both','combined'):
  for form in ('chained','bindings'):
   cmd=['node','--max-old-space-size=3072','--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',str(out/'worker.mjs'),variant,'100',form]
   p=subprocess.run(cmd,cwd='/tmp/di-bag-replacement-spike',capture_output=True,text=True,timeout=60)
   (out/(variant+'-'+form+'.stdout.log')).write_text(p.stdout);(out/(variant+'-'+form+'.stderr.log')).write_text(p.stderr)
   row={'variant':variant,'form':form,'status':p.returncode,'argv':cmd,'result':json.loads(p.stdout) if p.stdout.startswith('{') else None};rows.append(row);print(json.dumps(row),flush=True)
 (out/'rows.json').write_text(json.dumps(rows,indent=2)+'\n')
