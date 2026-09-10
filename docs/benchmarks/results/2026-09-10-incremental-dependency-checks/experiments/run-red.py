from pathlib import Path
import subprocess,json,fcntl
p=Path('/tmp/di-bag-empty-dependency-probe');root='/tmp/di-bag-replacement-spike'
with open('/tmp/di-bag-compiler-heavy.lock','a') as lock:
 fcntl.flock(lock,fcntl.LOCK_EX)
 cmd=['/tmp/di-bag-bun-1.4.0/bun-linux-x64/bun','test','tests/incremental-scale.test.ts']
 with open('/tmp/di-bag-dependency-checks-work-red.log','w') as log:r=subprocess.run(cmd,cwd=root,stdout=log,stderr=subprocess.STDOUT)
 print(json.dumps({'workRegressionStatus':r.returncode}),flush=True);assert r.returncode==1
 for variant in ('baseline','cached-with-new-shortcuts','cached-finite','guarded'):
  cmd=['node','--max-old-space-size=3072','--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',str(p/'regressions.mjs'),variant]
  r=subprocess.run(cmd,cwd=root,capture_output=True,text=True,timeout=60);(p/(variant+'.regressions.json')).write_text(r.stdout);(p/(variant+'.regressions.stderr')).write_text(r.stderr);assert r.returncode==0
  data=json.loads(r.stdout);print(json.dumps({'variant':variant,'diagnostics':data['diagnostics']}),flush=True)
  if variant in ('baseline','guarded'):assert not data['diagnostics']
  else:assert data['diagnostics']
