"""Library-free API and generic-history controls; never original matrix rows."""
import fcntl, hashlib, json, os, signal, subprocess, time
from pathlib import Path
root=Path(__file__).resolve().parents[4]
out=Path(__file__).resolve().parent/'module-controls'
out.mkdir(exist_ok=True)
with open('/tmp/di-bag-compiler-heavy.lock','a') as lock:
 fcntl.flock(lock,fcntl.LOCK_EX)
 with (out/'commands.jsonl').open('w') as f:
  for lane in ['classic','native']:
   for count in [100,500,1000]:
    for form in ['chained','replacement']:
     for kind in ['syntax','generic-history']:
      argv=['node','--max-old-space-size=3072','--disable-warning=MODULE_TYPELESS_PACKAGE_JSON','docs/benchmarks/results/2026-09-10-compiler-performance/module-controls-launch.mjs',lane,str(count),form,kind]
      start=time.monotonic();child=subprocess.Popen(argv,cwd=root,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,start_new_session=True);timeout=False
      try:stdout,stderr=child.communicate(timeout=80)
      except subprocess.TimeoutExpired:
       timeout=True;os.killpg(child.pid,signal.SIGKILL);stdout,stderr=child.communicate()
      p=out/f'{lane}-{count}-{form}-{kind}'/'source.ts'
      row={'lane':lane,'count':count,'form':form,'kind':kind,'argv':argv,'cwd':str(root),'status':child.returncode,'stdout':stdout,'stderr':stderr,'outerTimeout':timeout,'seconds':time.monotonic()-start,'generatedSha256':hashlib.sha256(p.read_bytes()).hexdigest()}
      f.write(json.dumps(row)+'\n');f.flush();print(json.dumps({k:row[k] for k in ['lane','count','form','kind','status','seconds']}),flush=True)
