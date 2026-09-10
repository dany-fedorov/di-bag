import subprocess,fcntl,json
from pathlib import Path
out=Path('/tmp/di-bag-named-checker-probe')
for count in [100,1000]:
 with open('/tmp/di-bag-compiler-heavy.lock','a') as lock:
  fcntl.flock(lock,fcntl.LOCK_EX)
  r=subprocess.run(['node','--max-old-space-size=3072','--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',str(out/'classic-worker.mjs'),'add-input',str(count),'chained'],cwd='/tmp/di-bag-replacement-spike',text=True,capture_output=True,timeout=60)
  (out/('add-input-'+str(count)+'chained.stdout.log')).write_text(r.stdout);(out/('add-input-'+str(count)+'chained.stderr.log')).write_text(r.stderr)
  print(json.dumps({'variant':'add-input','count':count,'status':r.returncode,'evidence':json.loads(r.stdout) if r.returncode==0 else None}),flush=True)
