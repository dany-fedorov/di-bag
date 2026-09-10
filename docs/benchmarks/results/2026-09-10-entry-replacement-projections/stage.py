from pathlib import Path
import shutil,json,hashlib,subprocess,sys,tarfile
repo=Path('/tmp/di-bag-replacement-spike');stage=Path('/tmp/di-bag-final-projection-evidence');stage.mkdir(exist_ok=True)
head=sys.argv[1];base='fb5fe6c736fc0c21b32b93dfc9e170c955209bb9'
assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=repo,text=True).strip()==head
assert not subprocess.check_output(['git','status','--porcelain=v1'],cwd=repo,text=True).strip()
def archive(origin,destination):
 with tarfile.open(destination,'w:gz') as tar:
  for f in sorted(origin.rglob('*')):
   if f.is_file() and not f.is_symlink() and 'node_modules' not in f.parts:
    name=str(f.relative_to(origin));assert not name.startswith('/') and '..' not in Path(name).parts
    info=tar.gettarinfo(str(f),name);info.uid=info.gid=0;info.uname=info.gname='';info.mtime=0
    with f.open('rb') as stream:tar.addfile(info,stream)
for label,origin in [('context-constraints',Path('/tmp/di-bag-replacement-projection-review')),('replacement-keys',Path('/tmp/di-bag-replacement-key-review')),('combined',Path('/tmp/di-bag-final-projection-review'))]:
 d=stage/'reviews'/label;d.mkdir(parents=True,exist_ok=True)
 for f in origin.iterdir():
  if f.is_file() and (f.name in ('review.md','summary.json','source-identity.json','markers.json','reproduce.sh','setup.py','run.mjs','verify-results.py') or f.suffix in ('.ts','.diff')):
   shutil.copyfile(f,d/f.name)
 archive(origin,d/'complete-review.tar.gz')
inter=stage/'intermediate';inter.mkdir(exist_ok=True)
origin=Path('/tmp/di-bag-replacement-projection-evidence')
(inter/'README.md').write_text('> Historical intermediate candidate. The complete original evidence and its manifest are preserved in [complete-evidence.tar.gz](complete-evidence.tar.gz). The manifest applies to the archive contents.\n\n'+(origin/'README.md').read_text().replace('(review/review.md)', '(../reviews/context-constraints/review.md)'));shutil.copyfile(origin/'measurements/summary.json',inter/'summary.json');shutil.copyfile(origin/'artifact-manifest.json',inter/'artifact-manifest.json');archive(origin,inter/'complete-evidence.tar.gz')
identity={'baseline':base,'candidate':head,'intermediate':'3360a96516daa7483c490a1bcacaa1ed16ec7ce1','productionFiles':{},'compilerInputs':{}}
for f in sorted((repo/'src').glob('*.ts')):
 before=subprocess.check_output(['git','show',base+':src/'+f.name],cwd=repo);after=f.read_bytes()
 identity['productionFiles'][f.name]={'baseline':hashlib.sha256(before).hexdigest(),'candidate':hashlib.sha256(after).hexdigest()}
 if before!=after:
  d=stage/'source';d.mkdir(exist_ok=True);(d/('baseline.'+f.name)).write_bytes(before);(d/('candidate.'+f.name)).write_bytes(after)
for f in ['tests/compiler.ts','scripts/compiler-case.ts','scripts/check-compiler-case.ts','scripts/native-scale.ts','scripts/native-compiler.ts','scripts/native-process.ts','package.json','package-lock.json']:
 identity['compilerInputs'][f]=hashlib.sha256((repo/f).read_bytes()).hexdigest()
 assert (repo/f).read_bytes()==subprocess.check_output(['git','show',base+':'+f],cwd=repo)
(stage/'source-manifest.json').write_text(json.dumps(identity,indent=2)+'\n')
gates=stage/'gates';gates.mkdir(exist_ok=True)
for pattern in ['di-bag-final-projection-integration-*.log','di-bag-final-projection-integration-verification.json','di-bag-final-projection-red.log','di-bag-final-projection-green.log','di-bag-final-projection-characterization-baseline.log']:
 for f in Path('/tmp').glob(pattern):shutil.copyfile(f,gates/f.name)
for name in ['collect','summarize','stage','verify','green','negatives','negative-oracle']:
 ext='.mjs' if name=='negative-oracle' else '.py'
 shutil.copyfile('/tmp/di-bag-final-projection-'+name+ext,stage/(name+ext))
probes=stage/'probes';probes.mkdir(exist_ok=True)
for d in [Path('/tmp/di-bag-named-checker-probe'),Path('/tmp/di-bag-replacement-key-probe')]:
 dest=probes/d.name;dest.mkdir(exist_ok=True)
 for f in d.iterdir():
  if f.is_file() and (f.suffix in ('.md','.json','.mjs','.py') or f.name.startswith(('final-projection.','entry-distributed.','distributed-keys.','entry-native1000','distributed-native1000','final-native1000'))):shutil.copyfile(f,dest/f.name)
 archive(d,dest/'complete-probes.tar.gz')
print(json.dumps({'stage':str(stage),'files':sum(1 for f in stage.rglob('*') if f.is_file()),'head':head}))
