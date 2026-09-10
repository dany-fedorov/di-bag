import subprocess,json,fcntl
from pathlib import Path
p=Path('/tmp/di-bag-completion-projection-probe');rows=[]
with open('/tmp/di-bag-compiler-heavy.lock','a') as lock:
 fcntl.flock(lock,fcntl.LOCK_EX)
 for form in ('bindings','modules'):
  cmd=['node','--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',str(p/'native-worker.mjs'),'completion','1000',form]
  r=subprocess.run(cmd,cwd='/tmp/di-bag-replacement-spike',capture_output=True,text=True,timeout=75)
  name='completion-native1000-'+form;(p/(name+'.stdout.log')).write_text(r.stdout);(p/(name+'.stderr.log')).write_text(r.stderr)
  data=json.loads(r.stdout);rows.append({'argv':cmd,'processStatus':r.returncode,'result':data});print(json.dumps({'form':form,'status':data.get('status'),'checked':data.get('checked'),'diagnostics':data.get('diagnostics'),'termination':data.get('terminationReason'),'metrics':data.get('metrics')}),flush=True)
 (p/'native-large-rows.json').write_text(json.dumps(rows,indent=2)+'\n')
