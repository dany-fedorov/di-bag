import subprocess,json,fcntl
from pathlib import Path
p=Path('/tmp/di-bag-completion-projection-probe');results={}
with open('/tmp/di-bag-compiler-heavy.lock','a') as lock:
 fcntl.flock(lock,fcntl.LOCK_EX)
 for variant in ('baseline','token-projection'):
  cmd=['node','--max-old-space-size=3072','--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',str(p/'contracts.mjs'),variant]
  r=subprocess.run(cmd,cwd='/tmp/di-bag-replacement-spike',capture_output=True,text=True,timeout=120)
  (p/(variant+'-contracts.json')).write_text(r.stdout);(p/(variant+'-contracts.stderr.log')).write_text(r.stderr)
  assert r.returncode==0,(variant,r.returncode,r.stderr)
  results[variant]=json.loads(r.stdout)
 a,b=results['baseline'],results['token-projection']
 summary={'files':[a['files'],b['files']],'diagnostics':[len(a['diagnostics']),len(b['diagnostics'])],'diagnosticsEqual':a['diagnostics']==b['diagnostics'],'declarations':[len(a['declarations']),len(b['declarations'])],'declarationsEqual':a['declarations']==b['declarations']}
 (p/'token-projection-contracts-summary.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps(summary))
