from pathlib import Path
import subprocess,fcntl,json
out=Path('/tmp/di-bag-named-checker-probe')
for form in ['chained','replacement']:
 for scenario in ['missing','wrong-shape']:
  with open('/tmp/di-bag-compiler-heavy.lock','a') as lock:
   fcntl.flock(lock,fcntl.LOCK_EX)
   r=subprocess.run(['node','--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',str(out/'native-worker.mjs'),'final-projection','1000',form,scenario],cwd='/tmp/di-bag-replacement-spike',text=True,capture_output=True,timeout=75)
   name='final-native1000-'+form+'-'+scenario
   (out/(name+'.stdout.log')).write_text(r.stdout);(out/(name+'.stderr.log')).write_text(r.stderr)
   e=json.loads(r.stdout) if r.returncode==0 else None
   print(json.dumps({'case':name,'status':r.returncode,'checked':e.get('checked') if e else None,'diagnostics':e.get('diagnostics') if e else None,'milliseconds':e.get('milliseconds') if e else None,'rssMiB':e.get('peakObservedRssMiB') if e else None}),flush=True)
