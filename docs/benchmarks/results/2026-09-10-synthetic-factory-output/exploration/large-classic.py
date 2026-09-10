import subprocess,fcntl,json,time
from pathlib import Path
out=Path('/tmp/di-bag-synthetic-factory-probe')
with open('/tmp/di-bag-compiler-heavy.lock','a') as lock:
 fcntl.flock(lock,fcntl.LOCK_EX)
 args=['node','--max-old-space-size=3072','--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',str(out/'classic-worker.mjs'),'candidate','1000','modules']
 start=time.monotonic()
 try:
  r=subprocess.run(args,cwd='/tmp/di-bag-replacement-spike',text=True,capture_output=True,timeout=60);stdout=r.stdout;stderr=r.stderr;status=r.returncode
 except subprocess.TimeoutExpired as e:
  stdout=(e.stdout or b'').decode();stderr=(e.stderr or b'').decode();status='timeout'
 (out/'candidate-classic1000modules.stdout.log').write_text(stdout);(out/'candidate-classic1000modules.stderr.log').write_text(stderr)
 row={'args':args,'status':status,'seconds':time.monotonic()-start,'evidence':json.loads(stdout) if stdout and status==0 else None};(out/'candidate-classic1000modules.json').write_text(json.dumps(row,indent=2)+'\n');print(json.dumps(row),flush=True)
