import io,json,pathlib,subprocess,tarfile,hashlib
root=pathlib.Path('/tmp/di-bag-synthetic-factory-review'); repo=pathlib.Path('/tmp/di-bag-replacement-spike'); prior=pathlib.Path('/tmp/di-bag-selected-resolution-review')
base='c058be3e4c2852c768a68591c94893ba75776a1c'
archive=subprocess.check_output(['git','-C',str(repo),'archive',base,'src'])
fixtures=['clean','contracts','context','reflected-inference','reflected-keys','entries-positive','entry-construction','install-wrappers']
for variant in ['baseline','candidate']:
 d=root/variant; d.mkdir(exist_ok=True)
 with tarfile.open(fileobj=io.BytesIO(archive)) as tar:tar.extractall(d,filter='data')
 (d/'tests').mkdir(exist_ok=True); (d/'consumer').mkdir(exist_ok=True)
 for f in ['provider','module-types']:
  snapshot=(prior/f'{variant}.synthetic.{f}.ts').read_bytes()
  if variant=='baseline':assert snapshot==(d/'src'/f'{f}.ts').read_bytes(),f
  (d/'src'/f'{f}.ts').write_bytes(snapshot)
 for f in fixtures:(d/'tests'/f'{f}.ts').write_bytes((prior/f'{f}.ts').read_bytes())
 (d/'tests'/'legacy-module-types.ts').write_text((prior/'baseline.synthetic.module-types.ts').read_text().replace("'./","'../src/"))
 (d/'consumer'/'entries.ts').write_text((prior/'entries-consumer.ts').read_text().replace("../dist/tests/entries'","../dist/tests/entries-positive'"))
identity={'base':base,'files':{}}
for file in (root/'baseline'/'src').glob('*.ts'):
 b=hashlib.sha256(file.read_bytes()).hexdigest();c=hashlib.sha256((root/'candidate'/'src'/file.name).read_bytes()).hexdigest()
 identity['files'][file.name]={'baseline':b,'candidate':c}
assert [n for n,s in identity['files'].items() if s['baseline']!=s['candidate']]==['provider.ts','module-types.ts'] or sorted([n for n,s in identity['files'].items() if s['baseline']!=s['candidate']])==['module-types.ts','provider.ts']
(root/'source-identity.json').write_text(json.dumps(identity,indent=2))
for variant in ['baseline','candidate']:
 for name in ['factories','deferred-equality']:(root/variant/'tests'/f'{name}.ts').write_bytes((root/f'{name}.ts').read_bytes())
 (root/variant/'consumer'/'factories.ts').write_bytes((root/'consumer.ts').read_bytes())
