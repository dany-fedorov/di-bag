from pathlib import Path
import subprocess,fcntl,sys,json
with open('/tmp/di-bag-compiler-heavy.lock','a') as lock:
 fcntl.flock(lock,fcntl.LOCK_EX)
 cmd=['/tmp/di-bag-bun-1.4.0/bun-linux-x64/bun','test','tests/types.test.ts','tests/incremental-scale.test.ts','tests/native-replacement-diagnostics.test.ts','tests/native-compiler.test.ts']
 with open('/tmp/di-bag-completion-projection-source-green.log','w') as log:r=subprocess.run(cmd,cwd='/tmp/di-bag-replacement-spike',stdout=log,stderr=subprocess.STDOUT)
 print(json.dumps({'argv':cmd,'status':r.returncode}));sys.exit(r.returncode)
