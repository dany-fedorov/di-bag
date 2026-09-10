import json,hashlib
from pathlib import Path
r=Path('/tmp/di-bag-synthetic-factory-review')
identity=json.loads((r/'source-identity.json').read_text())
for file,pinned in identity['files'].items():
 for variant in ['baseline','candidate']:
  assert hashlib.sha256((r/variant/'src'/file).read_bytes()).hexdigest()==pinned[variant],(file,variant)
summary={'base':identity['base'],'sourceFiles':len(identity['files']),'compilers':{}}
for kind,version,folder in [('classic','6.0.3','dist-classic'),('native','7.0.2','dist')]:
 results={}
 for stage in ['semantic','declarations','consumer']:
  data={v:json.loads((r/f'{kind}-{stage}-{v}.json').read_text().replace(str(r/v),'<ROOT>')) for v in ['baseline','candidate']}
  for v,d in data.items():
   assert d['version']==version
   if kind=='native':assert d['checked']
   if stage=='declarations' and kind=='classic':assert d['emitSkipped'] is False
   if stage!='semantic':assert d['diagnostics']==[],(kind,stage,v,d['diagnostics'])
  if stage=='semantic':
   assert data['baseline']['diagnostics']==data['candidate']['diagnostics']
   assert len(data['baseline']['diagnostics'])==16
   assert all(Path(d['file']).name in ['context.ts','reflected-keys.ts'] for d in data['baseline']['diagnostics'])
   if kind=='classic':
    assert data['baseline']['declarations']==data['candidate']['declarations']
    results['identicalInferredDeclarations']=len(data['baseline']['declarations'])
  results[stage]={'baselineDiagnostics':len(data['baseline']['diagnostics']),'candidateDiagnostics':len(data['candidate']['diagnostics'])}
 changed=[];count=0
 for file in (r/'baseline'/folder).rglob('*.d.ts'):
  count+=1;rel=file.relative_to(r/'baseline'/folder)
  if file.read_bytes()!=(r/'candidate'/folder/rel).read_bytes():changed.append(str(rel))
 assert sorted(changed)==['src/module-types.d.ts','src/provider.d.ts'],changed
 results['emittedFiles']=count;results['changedDeclarations']=changed
 summary['compilers'][kind]={'version':version,**results}
(r/'summary.json').write_text(json.dumps(summary,indent=2))
print(json.dumps(summary,indent=2))
