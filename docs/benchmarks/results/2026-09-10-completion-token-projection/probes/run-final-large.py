import subprocess,json,fcntl
from pathlib import Path
p=Path('/tmp/di-bag-completion-projection-probe');rows=[]
with open('/tmp/di-bag-compiler-heavy.lock','a') as lock:
 fcntl.flock(lock,fcntl.LOCK_EX)
 for lane in ('native','classic'):
  cmd=['node',*(['--max-old-space-size=3072'] if lane=='classic' else []),'--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',str(p/('native-worker.mjs' if lane=='native' else 'worker.mjs')),'token-projection','1000','bindings']
  name='token-projection-'+lane+'1000-bindings'
  try:
   r=subprocess.run(cmd,cwd='/tmp/di-bag-replacement-spike',capture_output=True,text=True,timeout=60 if lane=='classic' else 75)
   (p/(name+'.stdout.log')).write_text(r.stdout);(p/(name+'.stderr.log')).write_text(r.stderr)
   data=json.loads(r.stdout) if r.stdout.startswith('{') else None
   row={'lane':lane,'argv':cmd,'processStatus':r.returncode,'result':data};rows.append(row)
   print(json.dumps({'lane':lane,'processStatus':r.returncode,'result': {k:v for k,v in (data or {}).items() if k not in ('stdout','stderr')}}),flush=True)
  except subprocess.TimeoutExpired as e:
   (p/(name+'.stdout.log')).write_bytes(e.stdout or b'');(p/(name+'.stderr.log')).write_bytes(e.stderr or b'');row={'lane':lane,'argv':cmd,'processStatus':'timeout'};rows.append(row);print(json.dumps(row),flush=True)
 (p/'final-large-rows.json').write_text(json.dumps(rows,indent=2)+'\n')
