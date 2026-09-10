import subprocess,json,fcntl
from pathlib import Path
out=Path('/tmp/di-bag-requirement-index-probe');results={}
with open('/tmp/di-bag-compiler-heavy.lock','a') as lock:
 fcntl.flock(lock,fcntl.LOCK_EX)
 for name in ('baseline','key-only-map','parameter-output-context','parameter-noninfer-context'):
  cmd=['node','--max-old-space-size=3072','--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',str(out/'contracts.mjs'),name]
  p=subprocess.run(cmd,cwd='/tmp/di-bag-replacement-spike',capture_output=True,text=True,timeout=90)
  (out/(name+'.contracts.json')).write_text(p.stdout);(out/(name+'.contracts.stderr')).write_text(p.stderr)
  v=json.loads(p.stdout) if p.stdout.startswith('{') else None;results[name]=v
  print(json.dumps({'variant':name,'exit':p.returncode,'files':v['files'] if v else None,'diagnosticCount':len(v['diagnostics']) if v else None,'declarations':len(v['declarations']) if v else None}),flush=True)
 base=results['baseline']
 for name,v in results.items():
  if name=='baseline' or not v:continue
  diffs=[{'before':a,'after':b} for a,b in zip(base['declarations'],v['declarations']) if a!=b]
  before=[x for x in base['diagnostics'] if x not in v['diagnostics']];after=[x for x in v['diagnostics'] if x not in base['diagnostics']]
  diff={'variant':name,'declarationDiffs':diffs,'diagnosticsRemoved':before,'diagnosticsAdded':after}
  (out/(name+'.contract-diff.json')).write_text(json.dumps(diff,indent=2)+'\n')
  print(json.dumps({'variant':name,'declarationDiffs':len(diffs),'diagnosticsRemoved':len(before),'diagnosticsAdded':len(after)}),flush=True)
