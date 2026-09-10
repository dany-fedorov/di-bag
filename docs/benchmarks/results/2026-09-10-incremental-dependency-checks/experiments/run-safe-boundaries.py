import subprocess,json,fcntl
from pathlib import Path
out=Path('/tmp/di-bag-empty-dependency-probe');base=None
with open('/tmp/di-bag-compiler-heavy.lock','a') as lock:
 fcntl.flock(lock,fcntl.LOCK_EX)
 for variant in ('baseline','cached-safe-any'):
  cmd=['node','--max-old-space-size=3072','--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',str(out/'boundaries.mjs'),variant]
  p=subprocess.run(cmd,cwd='/tmp/di-bag-replacement-spike',capture_output=True,text=True,timeout=60)
  (out/(variant+'.boundaries.json')).write_text(p.stdout);(out/(variant+'.boundaries.stderr')).write_text(p.stderr)
  assert p.returncode==0,(variant,p.returncode,p.stderr)
  data=json.loads(p.stdout)
  if base is None: base=data
  result={'variant':variant,'histories':len(data['histories']), 'incoming':len(data['incoming']),'diagnostics':len(data['diagnostics']),'declarations':len(data['declarations']),'sameDiagnostics':data['diagnostics']==base['diagnostics'],'sameDeclarations':data['declarations']==base['declarations']}
  print(json.dumps(result),flush=True)
