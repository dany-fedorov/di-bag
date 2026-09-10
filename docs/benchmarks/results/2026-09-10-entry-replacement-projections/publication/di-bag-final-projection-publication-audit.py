from pathlib import Path, PurePosixPath
import hashlib,json,subprocess,tarfile,io,re
repo=Path('/tmp/di-bag-replacement-spike');stage=Path('/tmp/di-bag-final-projection-evidence')
base='fb5fe6c736fc0c21b32b93dfc9e170c955209bb9';head='59d10c6c8ac13d63171f9f39c170da048d7e208c'
sha=lambda b:hashlib.sha256(b).hexdigest()
def git(*args):return subprocess.check_output(['git','-C',str(repo),*args])
assert git('rev-parse','HEAD').decode().strip()==head
assert not git('status','--porcelain=v1').strip()
identity=json.loads((stage/'source-manifest.json').read_text());assert identity['baseline']==base and identity['candidate']==head
source={}
for f,pins in identity['productionFiles'].items():
 source[f]={}
 for label,commit in [('baseline',base),('candidate',head)]:
  data=git('show',f'{commit}:src/{f}');assert sha(data)==pins[label],(f,label)
  source[f][label]=sha(data)
  if label=='candidate':assert data==(repo/'src'/f).read_bytes()
assert len(source)==35
assert sorted(f for f,x in source.items() if x['baseline']!=x['candidate'])==['di-bag.ts','module-types.ts','types.ts']
for f,hashed in identity['compilerInputs'].items():assert sha(git('show',head+':'+f))==sha(git('show',base+':'+f))==hashed,f
reviews={}
for label,path in [('context-constraints',Path('/tmp/di-bag-replacement-projection-review')),('replacement-keys',Path('/tmp/di-bag-replacement-key-review')),('combined',Path('/tmp/di-bag-final-projection-review'))]:
 d=stage/'reviews'/label
 for name in ['review.md','source-identity.json','summary.json']:
  assert (d/name).read_bytes()==(path/name).read_bytes(),(label,name)
 pins=json.loads((d/'source-identity.json').read_text());summary=json.loads((d/'summary.json').read_text());reviews[label]={'base':pins['base'],'sourceFiles':len(pins['files']),'summary':summary,'reportSha256':sha((d/'review.md').read_bytes())}
 if label=='combined':
  for f,hashes in pins['files'].items():assert hashes['candidate']==source[f]['candidate'],f
 if label=='context-constraints':
  for f,hashes in pins['files'].items():
   assert hashes['baseline']==source[f]['baseline'],f
   if f in ['di-bag.ts','module-types.ts']:assert hashes['candidate']==source[f]['candidate'],f
archives=[]
def scan_archive(data,name,depth=0):
 assert depth<8,name
 with tarfile.open(fileobj=io.BytesIO(data),mode='r:gz') as t:
  files={};members=t.getmembers()
  for m in members:
   p=PurePosixPath(m.name)
   assert m.isfile() and not m.issym() and not m.islnk(),(name,m.name,m.type)
   assert not p.is_absolute() and '..' not in p.parts and 'node_modules' not in p.parts,(name,m.name)
   assert m.name not in files,(name,'duplicate',m.name)
   files[m.name]=t.extractfile(m).read()
  manifests=[]
  for p,b in files.items():
   if p.endswith('artifact-manifest.json'):
    parsed=json.loads(b);parent=str(PurePosixPath(p).parent);prefix='' if parent=='.' else parent+'/'
    # Historical copied intermediate manifests explicitly apply to their separate archive, not the copied overview directory.
    if prefix and prefix+'complete-evidence.tar.gz' in files:continue
    for rel,v in parsed['files'].items():
     full=prefix+rel;assert full in files,(name,p,full,'missing')
     h=v['sha256'] if isinstance(v,dict) else v;assert sha(files[full])==h,(name,p,full,'hash')
     if isinstance(v,dict) and 'bytes'in v:assert len(files[full])==v['bytes'],(name,full,'bytes')
    manifests.append({'path':p,'verifiedFiles':len(parsed['files'])})
  archives.append({'archive':name,'members':len(files),'uncompressedBytes':sum(map(len,files.values())),'manifestChecks':manifests})
  for p,b in files.items():
   if p.endswith('.tar.gz'):scan_archive(b,name+'!'+p,depth+1)
for p in sorted(stage.rglob('*.tar.gz')):scan_archive(p.read_bytes(),str(p.relative_to(stage)))
gates=json.loads((stage/'gates/di-bag-final-projection-integration-verification.json').read_text());assert len(gates)==18 and all(x['status']==0 for x in gates)
for g in gates:
 original=Path(g['log']);assert original.read_bytes()==(stage/'gates'/original.name).read_bytes(),g['step']
full=(stage/'gates/di-bag-final-projection-integration-full-check.log').read_text();assert '943 pass' in full and '0 fail' in full and '18899 expect() calls' in full
native=[json.loads(x) for x in (stage/'gates/di-bag-final-projection-integration-native-audit.log').read_text().splitlines() if x.startswith('{')];assert native[-1]['files']==124 and native[-1]['expected']==native[-1]['matched']==639 and native[-1]['unexpected']==native[-1]['failures']==0
for compiler in ['classic','native']:
 node=(stage/f'gates/di-bag-final-projection-integration-{compiler}-node.log').read_text();assert 'tests 31' in node and 'pass 31' in node and 'fail 0' in node
result={'base':base,'head':head,'clean':True,'sourceFiles':source,'unchangedCompilerInputs':identity['compilerInputs'],'reviews':reviews,'archives':archives,'gates':{'passed':18,'tests':943,'assertions':18899,'nodeTestsPerCompiler':31,'nativeAudit':native[-1]},'finalArtifactManifestPresent':(stage/'artifact-manifest.json').exists(),'finalMeasurementsPresent':(stage/'measurements/summary.json').exists()}
Path('/tmp/di-bag-final-projection-publication-support.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({'sourceFiles':35,'reviewScopes':list(reviews),'archives':len(archives),'archiveMembers':sum(x['members'] for x in archives),'nestedManifestsChecked':sum(len(x['manifestChecks']) for x in archives),'gates':result['gates'],'finalManifestPresent':result['finalArtifactManifestPresent'],'finalMeasurementsPresent':result['finalMeasurementsPresent']},indent=2))
