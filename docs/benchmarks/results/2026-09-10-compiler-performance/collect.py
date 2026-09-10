"""Retain serial original-generator observations, including rejected outcomes."""
import argparse, fcntl, hashlib, json, os, shutil, signal, subprocess, time
from pathlib import Path
parser=argparse.ArgumentParser()
parser.add_argument('label')
parser.add_argument('cases',nargs='+',help='lane:count:form:scenario, or full')
a=parser.parse_args()
root=Path(__file__).resolve().parents[4]
out=Path(__file__).resolve().parent/a.label
out.mkdir(exist_ok=False)
def git(*args):return subprocess.check_output(['git',*args],cwd=root,text=True).strip()
def hashes(folder):return {str(p.relative_to(folder)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(folder.rglob('*')) if p.is_file()}
cases=a.cases
if cases==['full']:
 cases=[f'{lane}:{count}:{form}:{scenario}' for lane in ['classic','native'] for count in [100,500,1000] for form in ['bulk','chained','grouped','replacement','bindings','modules'] for scenario in (['valid','missing-final-token','mismatched-invariant-service'] if form in ['bindings','modules'] else ['valid','missing','wrong-shape'])]
with open('/tmp/di-bag-compiler-heavy.lock','a') as lock:
 fcntl.flock(lock,fcntl.LOCK_EX)
 source=hashes(root/'src')
 manifest={'status':'running','command':['python3',str(Path(__file__).relative_to(root)),*os.sys.argv[1:]],'commit':git('rev-parse','HEAD'),'sourceStatus':git('status','--porcelain','--','src'),'source':source,'build':hashes(root/'dist'),'cases':cases,'node':subprocess.check_output(['node','--version'],text=True).strip(),'limits':{'workerSeconds':60,'workerMiB':3072,'outputBytes':4194304,'defaultStack':True,'outerSeconds':100}}
 shutil.copytree(root/'src',out/'src')
 (out/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
 accepted=0
 with (out/'commands.jsonl').open('w') as commands,(out/'rows.jsonl').open('w') as rows:
  for case in cases:
   lane,count,form,scenario=case.split(':')
   argv=['node','--disable-warning=MODULE_TYPELESS_PACKAGE_JSON','scripts/check-compiler-case.ts',lane,count,form,scenario]
   start=time.monotonic();child=subprocess.Popen(argv,cwd=root,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,start_new_session=True);outer=False
   try:stdout,stderr=child.communicate(timeout=100)
   except subprocess.TimeoutExpired:
    outer=True;os.killpg(child.pid,signal.SIGKILL);stdout,stderr=child.communicate()
   command={'argv':argv,'cwd':str(root),'status':child.returncode,'stdout':stdout,'stderr':stderr,'outerTimeout':outer,'elapsedSeconds':time.monotonic()-start}
   commands.write(json.dumps(command)+'\n');commands.flush()
   try:
    row=json.loads(stdout);assert isinstance(row,dict)
   except (ValueError,AssertionError) as error:row={'lane':lane,'count':int(count),'form':form,'scenario':scenario,'accepted':False,'collectorParseError':str(error),'status':child.returncode}
   rows.write(json.dumps(row)+'\n');rows.flush();accepted+=row.get('accepted') is True
   print(json.dumps({'case':case,'accepted':row.get('accepted'),'instantiations':row.get('instantiations',row.get('nativeMetrics',{}).get('Instantiations')),'elapsedSeconds':round(command['elapsedSeconds'],2),'failureReason':row.get('failureReason')}),flush=True)
 manifest.update(status='complete',accepted=accepted,rows=len(cases),commitAfter=git('rev-parse','HEAD'),sourceUnchanged=source==hashes(root/'src'))
 (out/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
 assert manifest['sourceUnchanged'] and manifest['commit']==manifest['commitAfter']
