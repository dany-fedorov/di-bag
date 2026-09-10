import json,hashlib,difflib
from pathlib import Path
r=Path('/tmp/di-bag-final-projection-review');identity=json.loads((r/'source-identity.json').read_text())
for f,hashes in identity['files'].items():
 for v in ['baseline','candidate']:assert hashlib.sha256((r/v/'src'/f).read_bytes()).hexdigest()==hashes[v],(f,v)
summary={'base':identity['base'],'sourceFiles':len(identity['files']),'candidateTypesSha256':identity['files']['types.ts']['candidate'],'targetedReplacementEqualities':35,'directReplacementOutputAssertions':8,'legacyEntriesAssertions':19,'compilers':{}}
key=lambda d:{k:v for k,v in d.items() if k!='message'}
for kind,version in [('classic','6.0.3'),('native','7.0.2')]:
 result={}
 for stage in ['semantic','open','declarations','consumer']:
  data={v:json.loads((r/f'{kind}-{stage}-{v}.json').read_text().replace(str(r/v),'<ROOT>')) for v in ['baseline','candidate']}
  for v,d in data.items():
   assert d['version']==version
   if kind=='native':assert d['checked']
   if stage in ['inference','declarations','consumer']:assert d['diagnostics']==[],(kind,v,stage,d['diagnostics'])
   if kind=='classic' and stage=='declarations':assert d['emitSkipped'] is False
  assert list(map(key,data['baseline']['diagnostics']))==list(map(key,data['candidate']['diagnostics'])),(kind,stage)
  if stage=='semantic':
   assert len(data['baseline']['diagnostics'])==57
   assert all('/negative/' in x['file'] for x in data['candidate']['diagnostics'])
  if stage=='open':assert len(data['baseline']['diagnostics'])==24
  dif=[{'baseline':b,'candidate':c} for b,c in zip(data['baseline']['diagnostics'],data['candidate']['diagnostics']) if b!=c]
  (r/f'{kind}-{stage}-diagnostic-differences.json').write_text(json.dumps(dif,indent=2))
  result[stage]={'diagnosticsEach':len(data['candidate']['diagnostics']),'sameDiagnosticCodesAndLocations':True,'diagnosticTextDifferences':len(dif)}
  if kind=='classic':
   assert data['baseline']['declarations']==data['candidate']['declarations'],(stage,'type rendering difference')
   result[stage]['identicalInferredDeclarations']=len(data['baseline']['declarations'])
 changed=[];count=0
 for f in (r/'baseline'/f'dist-{kind}').rglob('*.d.ts'):
  count+=1;rel=f.relative_to(r/'baseline'/f'dist-{kind}');other=r/'candidate'/f'dist-{kind}'/rel
  if f.read_bytes()!=other.read_bytes():
   changed.append(str(rel));(r/(kind+'-'+str(rel).replace('/','-')+'.diff')).write_text(''.join(difflib.unified_diff(f.read_text().splitlines(True),other.read_text().splitlines(True),fromfile='baseline/'+str(rel),tofile='candidate/'+str(rel))))
 assert sorted(changed)==sorted(['src/types.d.ts']+(['review/generic-entries-positive.d.ts'] if kind=='native' else [])),changed
 result['emittedFiles']=count;result['changedEmittedFiles']=changed
 summary['compilers'][kind]={'version':version,**result}
(r/'summary.json').write_text(json.dumps(summary,indent=2));print(json.dumps(summary,indent=2))
