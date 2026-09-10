import subprocess,json,fcntl
from pathlib import Path
out=Path('/tmp/di-bag-requirement-index-probe');rows=[]
with open('/tmp/di-bag-compiler-heavy.lock','a') as lock:
 fcntl.flock(lock,fcntl.LOCK_EX)
 for name in ('key-only-map', 'output-noinfer', 'history-key-noinfer', 'parameter-output-context', 'parameter-noninfer-context', 'parameter-unknown-v'):
  cmd=['node','--max-old-space-size=3072','--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',str(out/'worker.mjs'),name,'100']
  p=subprocess.run(cmd,cwd='/tmp/di-bag-replacement-spike',capture_output=True,text=True,timeout=60)
  (out/(name+'.stdout.log')).write_text(p.stdout);(out/(name+'.stderr.log')).write_text(p.stderr)
  row={'variant':name,'status':p.returncode,'argv':cmd,'result':json.loads(p.stdout) if p.stdout.startswith('{') else None};rows.append(row);print(json.dumps(row),flush=True)
 (out/'inference-rows.json').write_text(json.dumps(rows,indent=2)+'\n')
