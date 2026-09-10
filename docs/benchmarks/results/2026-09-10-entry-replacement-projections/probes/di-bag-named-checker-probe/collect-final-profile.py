import subprocess,fcntl,json,hashlib
from pathlib import Path
out=Path('/tmp/di-bag-named-checker-probe')
with open('/tmp/di-bag-compiler-heavy.lock','a') as lock:
 fcntl.flock(lock,fcntl.LOCK_EX)
 r=subprocess.run(['node','--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',str(out/'profile-final-native.mjs')],cwd='/tmp/di-bag-replacement-spike',text=True,capture_output=True,timeout=75)
 (out/'native500-final-profile.stdout.log').write_text(r.stdout);(out/'native500-final-profile.stderr.log').write_text(r.stderr)
 assert r.returncode==0 and not r.stderr
 p=next((out/'native500-final/profiles').glob('*cpuprofile.pb.gz'))
 s=subprocess.check_output(['python3',str(out/'read-profile.py'),str(p)],text=True);(out/'native500-final-cpu-summary.json').write_text(s)
 files={str(f.relative_to(out/'native500-final/src')):hashlib.sha256(f.read_bytes()).hexdigest() for f in sorted((out/'native500-final/src').glob('*.ts'))}
 (out/'native500-final-source-identity.json').write_text(json.dumps(files,indent=2)+'\n')
 print(json.dumps({'probe':'final native500 diagnostic CPU profile','status':0,'totalSamples':json.loads(s)['total'],'topFlat':json.loads(s)['flat'][:4]}),flush=True)
