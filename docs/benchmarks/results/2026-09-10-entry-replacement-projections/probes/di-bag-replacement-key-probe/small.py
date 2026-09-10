import subprocess,fcntl,json
from pathlib import Path
out=Path('/tmp/di-bag-replacement-key-probe')
for variant in ['distributed-keys']:
 with open('/tmp/di-bag-compiler-heavy.lock','a') as lock:
  fcntl.flock(lock,fcntl.LOCK_EX)
  r=subprocess.run(['node','--max-old-space-size=3072','--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',str(out/'classic-worker.mjs'),variant,'100','replacement'],cwd='/tmp/di-bag-replacement-spike',text=True,capture_output=True,timeout=60)
  (out/(variant+'-100replacement.stdout.log')).write_text(r.stdout);(out/(variant+'-100replacement.stderr.log')).write_text(r.stderr)
  print(json.dumps({'variant':variant,'status':r.returncode,'evidence':json.loads(r.stdout) if r.returncode==0 else None}),flush=True)
  assert r.returncode==0 and not r.stderr
