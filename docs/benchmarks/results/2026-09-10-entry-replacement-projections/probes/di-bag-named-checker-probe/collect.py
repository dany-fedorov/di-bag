from pathlib import Path
import fcntl,subprocess,json,time
out=Path('/tmp/di-bag-named-checker-probe')
for name,argv in [('classic-stack',['node','--max-old-space-size=3072','--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',str(out/'classic-stack.mjs')]),('native500-profile',['node','--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',str(out/'profile-native.mjs')])]:
 with open('/tmp/di-bag-compiler-heavy.lock','a') as lock:
  fcntl.flock(lock,fcntl.LOCK_EX);start=time.monotonic();r=subprocess.run(argv,cwd='/tmp/di-bag-replacement-spike',text=True,capture_output=True,timeout=75)
  (out/(name+'.stdout.log')).write_text(r.stdout);(out/(name+'.stderr.log')).write_text(r.stderr)
  print(json.dumps({'name':name,'status':r.returncode,'seconds':time.monotonic()-start,'stdoutBytes':len(r.stdout),'stderrBytes':len(r.stderr)}),flush=True)
