import subprocess,fcntl,json
from pathlib import Path
out=Path('/tmp/di-bag-classic-depth-probe')
for form in ['chained','replacement']:
 with open('/tmp/di-bag-compiler-heavy.lock','a') as lock:
  fcntl.flock(lock,fcntl.LOCK_EX)
  r=subprocess.run(['node','--max-old-space-size=3072','--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',str(out/'classic-worker.mjs'),'final-baseline','1000',form],cwd='/tmp/di-bag-replacement-spike',text=True,capture_output=True,timeout=60)
  (out/('final-baseline-1000'+form+'.stdout.log')).write_text(r.stdout);(out/('final-baseline-1000'+form+'.stderr.log')).write_text(r.stderr)
  print(json.dumps({'variant':'actual final-projection source','form':form,'status':r.returncode,'evidence':json.loads(r.stdout) if r.returncode==0 else None}),flush=True)
