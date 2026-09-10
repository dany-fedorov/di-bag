from pathlib import Path
import hashlib,tarfile,json,subprocess
stage=Path('/tmp/di-bag-final-projection-evidence');repo=Path('/tmp/di-bag-replacement-spike');sha=lambda b:hashlib.sha256(b).hexdigest()
origins={
'reviews/context-constraints/complete-review.tar.gz':Path('/tmp/di-bag-replacement-projection-review'),
'reviews/replacement-keys/complete-review.tar.gz':Path('/tmp/di-bag-replacement-key-review'),
'reviews/combined/complete-review.tar.gz':Path('/tmp/di-bag-final-projection-review'),
'intermediate/complete-evidence.tar.gz':Path('/tmp/di-bag-replacement-projection-evidence'),
'probes/di-bag-named-checker-probe/complete-probes.tar.gz':Path('/tmp/di-bag-named-checker-probe'),
'probes/di-bag-replacement-key-probe/complete-probes.tar.gz':Path('/tmp/di-bag-replacement-key-probe')}
results=[]
for rel,origin in origins.items():
 with tarfile.open(stage/rel) as t:
  count=0;files={}
  for m in t.getmembers():
   raw=t.extractfile(m).read();assert (origin/m.name).is_file(),(rel,m.name,'missing original')
   assert sha(raw)==sha((origin/m.name).read_bytes()),(rel,m.name,'differs from original')
   assert m.uid==m.gid==m.mtime==0 and m.uname==m.gname=='',(rel,m.name,'non-normalized metadata')
   assert '.git' not in Path(m.name).parts,(rel,m.name,'git metadata')
   files[m.name]=raw;count+=1
  if 'source-identity.json' in files:
   identity=json.loads(files['source-identity.json'])
   for f,ids in identity['files'].items():
    for v in ['baseline','candidate']:assert sha(files[f'{v}/src/{f}'])==ids[v],(rel,v,f)
  if rel.startswith('probes/di-bag-named-checker'):
   profiles=[]
   for folder,commit in [('native500','3360a96516daa7483c490a1bcacaa1ed16ec7ce1'),('native500-final','59d10c6c8ac13d63171f9f39c170da048d7e208c')]:
    sr=[(p,b) for p,b in files.items() if p.startswith(folder+'/src/') and p.endswith('.ts')]
    assert len(sr)==35,(folder,len(sr))
    for p,b in sr:assert b==subprocess.check_output(['git','-C',str(repo),'show',commit+':'+p[len(folder)+1:]]),(p,commit)
    profiles.append({'folder':folder,'commit':commit,'sourceFiles':35})
  else:profiles=[]
  results.append({'archive':rel,'archivedFilesMatchOriginals':count,'reviewSourceHashesVerified':'source-identity.json' in files,'profileSourceRevisions':profiles})
before=json.loads((stage/'probes/di-bag-named-checker-probe/native500-cpu-summary.json').read_text());after=json.loads((stage/'probes/di-bag-named-checker-probe/native500-final-cpu-summary.json').read_text())
assert before['total']==23430000000 and before['sourceFileLookup']['value']==15810000000 and round(before['sourceFileLookup']['percent'],2)==67.48
assert after['total']==7320000000 and after['sourceFileLookup']['value']==0
result={'archives':results,'profileClaims':{'beforeCpuNanoseconds':before['total'],'beforeLookupNanoseconds':before['sourceFileLookup']['value'],'beforeLookupPercent':before['sourceFileLookup']['percent'],'afterCpuNanoseconds':after['total'],'afterLookupNanoseconds':after['sourceFileLookup']['value']}}
Path('/tmp/di-bag-final-projection-publication-archives.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
