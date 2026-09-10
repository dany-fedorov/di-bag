"""Compare both emitters from retained baseline/final source; not a pre-edit build snapshot."""
import fcntl, hashlib, json, shutil, subprocess, time
from pathlib import Path
base=Path(__file__).resolve().parent;root=base.parents[3];out=base/'builds';out.mkdir(exist_ok=False)
def hashes(folder,suffix=None):return {str(p.relative_to(folder)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(folder.rglob('*')) if p.is_file() and (suffix is None or p.suffix==suffix)}
with open('/tmp/di-bag-compiler-heavy.lock','a') as lock:
 fcntl.flock(lock,fcntl.LOCK_EX)
 rows=[]
 for lane in ['classic','native']:
  for phase in ['before','after']:
   tree=out/f'{lane}-{phase}';tree.mkdir()
   shutil.copytree(base/'before/src' if phase=='before' else root/'src',tree/'src')
   for name in ['package.json','tsconfig.json','tsconfig.build.json']:shutil.copyfile(root/name,tree/name)
   argv=['node',str(root/'node_modules/typescript/bin/tsc6'),'-p','tsconfig.build.json'] if lane=='classic' else [str(root/'node_modules/@typescript/typescript-linux-x64/lib/tsc'),'-p','tsconfig.build.json']
   start=time.monotonic();p=subprocess.run(argv,cwd=tree,capture_output=True,text=True)
   row={'lane':lane,'phase':phase,'argv':argv,'cwd':str(tree),'status':p.returncode,'stdout':p.stdout,'stderr':p.stderr,'seconds':time.monotonic()-start,'source':hashes(tree/'src'),'build':hashes(tree/'dist')}
   rows.append(row);print(json.dumps({k:row[k] for k in ['lane','phase','status','seconds']}),flush=True)
   (out/'commands.jsonl').write_text(''.join(json.dumps(r)+'\n' for r in rows))
   assert p.returncode==0 and not p.stderr
  assert hashes(out/f'{lane}-before/dist','.js')==hashes(out/f'{lane}-after/dist','.js'),lane
 (out/'summary.json').write_text(json.dumps({'note':'Builds reconstructed after measurement from exact retained before/final source, with unchanged configs and pinned compilers. Never relabeled as pre-edit observations.','classicJavaScriptIdentical':True,'nativeJavaScriptIdentical':True,'commands':4},indent=2)+'\n')
