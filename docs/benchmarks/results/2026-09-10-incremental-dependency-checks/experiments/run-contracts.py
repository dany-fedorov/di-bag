import subprocess,json,fcntl
from pathlib import Path
out=Path('/tmp/di-bag-empty-dependency-probe');base=None
with open('/tmp/di-bag-compiler-heavy.lock','a') as lock:
 fcntl.flock(lock,fcntl.LOCK_EX)
 for variant in ('baseline','new-and-disjoint','cached-with-new-shortcuts'):
  cmd=['node','--max-old-space-size=3072','--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',str(out/'contracts.mjs'),variant]
  p=subprocess.run(cmd,cwd='/tmp/di-bag-replacement-spike',capture_output=True,text=True,timeout=60)
  (out/(variant+'.contracts.json')).write_text(p.stdout);(out/(variant+'.contracts.stderr')).write_text(p.stderr)
  assert p.returncode==0,(variant,p.returncode,p.stderr)
  data=json.loads(p.stdout)
  if base is None: base=data
  result={'variant':variant,'files':data['files'],'diagnostics':len(data['diagnostics']),'declarations':len(data['declarations']),'sameDiagnostics':data['diagnostics']==base['diagnostics'],'sameDeclarations':data['declarations']==base['declarations']}
  print(json.dumps(result),flush=True)
