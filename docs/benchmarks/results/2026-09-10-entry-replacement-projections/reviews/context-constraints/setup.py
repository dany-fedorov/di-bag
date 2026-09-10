import pathlib, subprocess, tarfile, io, hashlib, json
root=pathlib.Path('/tmp/di-bag-replacement-projection-review'); repo=pathlib.Path('/tmp/di-bag-replacement-spike'); probe=pathlib.Path('/tmp/di-bag-replacement-context-factory-probe')
base='3a42173d9faacc63ad7728545580a63389d56de2'
archive=subprocess.check_output(['git','-C',str(repo),'archive',base,'src','tests/types'])
for v in ['baseline','candidate']:
 d=root/v; d.mkdir(exist_ok=True)
 with tarfile.open(fileobj=io.BytesIO(archive)) as tar:tar.extractall(d,filter='data')
 for f in ['di-bag','module-types']:
  assert (d/'src'/f'{f}.ts').read_bytes()==(probe/f'baseline.{f}.ts').read_bytes()
  if v=='candidate':(d/'src'/f'{f}.ts').write_bytes((probe/f'combined.{f}.ts').read_bytes())
 (d/'review').mkdir(exist_ok=True)
 (d/'review'/'legacy-module-types.ts').write_text((probe/'baseline.module-types.ts').read_text().replace("'./", "'../src/"))
 for name in ['constraints','replacement','open-generics']:
  (d/'review'/f'{name}.ts').write_bytes((root/f'{name}.ts').read_bytes())
identity={'base':base,'files':{}}
for f in (root/'baseline'/'src').glob('*.ts'):
 identity['files'][f.name]={v:hashlib.sha256((root/v/'src'/f.name).read_bytes()).hexdigest() for v in ['baseline','candidate']}
assert sorted([f for f,ids in identity['files'].items() if ids['baseline']!=ids['candidate']])==['di-bag.ts','module-types.ts']
(root/'source-identity.json').write_text(json.dumps(identity,indent=2))
