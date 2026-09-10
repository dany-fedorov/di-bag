import subprocess,fcntl,sys
from pathlib import Path
root='/tmp/di-bag-replacement-spike'
with open('/tmp/di-bag-compiler-heavy.lock','a') as lock:
 fcntl.flock(lock,fcntl.LOCK_EX)
 with open('/tmp/di-bag-final-projection-green.log','w') as log:
  for argv in [['node','--disable-warning=MODULE_TYPELESS_PACKAGE_JSON','/tmp/di-bag-check-incremental-fixture.mjs'],['/tmp/di-bag-bun-1.4.0/bun-linux-x64/bun','test','tests/incremental-scale.test.ts','tests/native-compiler.test.ts','-t','incremental compiler work|1000 named replacements|1000 dependent named additions']]:
   r=subprocess.run(argv,cwd=root,stdout=log,stderr=subprocess.STDOUT);log.flush()
   if r.returncode:sys.exit(r.returncode)
