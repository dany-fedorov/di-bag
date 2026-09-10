import subprocess,fcntl,json,time
from pathlib import Path
root=Path('/tmp/di-bag-replacement-spike');out=Path('/tmp/di-bag-synthetic-factory-probe')
for form in ['chained','replacement','bindings','modules']:
 with open('/tmp/di-bag-compiler-heavy.lock','a') as lock:
  fcntl.flock(lock,fcntl.LOCK_EX)
  args=['node','--max-old-space-size=3072','--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',str(out/'classic-worker.mjs'),'candidate','100',form]
  start=time.monotonic(); r=subprocess.run(args,cwd=root,text=True,capture_output=True,timeout=60)
  (out/('candidate-classic100'+form+'.stdout.log')).write_text(r.stdout);(out/('candidate-classic100'+form+'.stderr.log')).write_text(r.stderr)
  print(json.dumps({'form':form,'status':r.returncode,'seconds':time.monotonic()-start,'result':json.loads(r.stdout) if r.returncode==0 else None}),flush=True)
  assert r.returncode==0 and not r.stderr
