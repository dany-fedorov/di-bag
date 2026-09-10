import subprocess,fcntl,json
from pathlib import Path
p=Path('/tmp/di-bag-selected-resolution-probe')
with open('/tmp/di-bag-compiler-heavy.lock','a') as lock:
 fcntl.flock(lock,fcntl.LOCK_EX)
 cmd=['node','--max-old-space-size=3072','--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',str(p/'trace-worker.mjs'),'baseline','1000','bindings']
 try:
  r=subprocess.run(cmd,cwd='/tmp/di-bag-replacement-spike',capture_output=True,text=True,timeout=60)
  (p/'classic-1000-bindings-trace.stdout.log').write_text(r.stdout);(p/'classic-1000-bindings-trace.stderr.log').write_text(r.stderr)
  print(json.dumps({'status':r.returncode,'argv':cmd,'purpose':'diagnostic attribution only; in-memory compiler logging, no limit changes'}))
 except subprocess.TimeoutExpired as e:
  (p/'classic-1000-bindings-trace.stdout.log').write_bytes(e.stdout or b'');(p/'classic-1000-bindings-trace.stderr.log').write_bytes(e.stderr or b'');print(json.dumps({'status':'timeout','argv':cmd}))
