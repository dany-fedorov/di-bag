import subprocess,fcntl,json
from pathlib import Path
out=Path('/tmp/di-bag-named-checker-probe')
variant='history-invariant'
for form in ['chained','replacement']:
 with open('/tmp/di-bag-compiler-heavy.lock','a') as lock:
  fcntl.flock(lock,fcntl.LOCK_EX)
  r=subprocess.run(['node','--max-old-space-size=3072','--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',str(out/'classic-worker.mjs'),variant,'100',form],cwd='/tmp/di-bag-replacement-spike',text=True,capture_output=True,timeout=60)
  (out/(variant+'-100'+form+'.stdout.log')).write_text(r.stdout);(out/(variant+'-100'+form+'.stderr.log')).write_text(r.stderr)
  print(json.dumps({'variant':variant,'form':form,'status':r.returncode,'evidence':json.loads(r.stdout) if r.returncode==0 else None}),flush=True)
  assert r.returncode==0 and not r.stderr
