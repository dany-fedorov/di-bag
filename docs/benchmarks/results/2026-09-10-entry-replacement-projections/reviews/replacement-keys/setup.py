import pathlib,subprocess,tarfile,io,hashlib,json
root=pathlib.Path('/tmp/di-bag-replacement-key-review');repo=pathlib.Path('/tmp/di-bag-replacement-spike');probe=pathlib.Path('/tmp/di-bag-replacement-key-probe')
base='3360a96516daa7483c490a1bcacaa1ed16ec7ce1'
archive=subprocess.check_output(['git','-C',str(repo),'archive',base,'src','tests/types'])
for variant in ['baseline','candidate']:
 d=root/variant;d.mkdir(exist_ok=True)
 with tarfile.open(fileobj=io.BytesIO(archive)) as tar:tar.extractall(d,filter='data')
 for f in ['di-bag','module-types','provider']:assert (d/'src'/f'{f}.ts').read_bytes()==(probe/f'distributed-keys.{f}.ts').read_bytes(),f
 (d/'review').mkdir(exist_ok=True)
 (d/'review'/'legacy-types.ts').write_text((d/'src/types.ts').read_text().replace("'./","'../src/"))
 if variant=='candidate':(d/'src/types.ts').write_bytes((probe/'distributed-keys.types.ts').read_bytes())
 for f in ['output','open','replacement','inference']:(d/'review'/f'{f}.ts').write_bytes((root/f'{f}.ts').read_bytes())
identity={'base':base,'files':{}}
for f in (root/'baseline/src').glob('*.ts'):identity['files'][f.name]={v:hashlib.sha256((root/v/'src'/f.name).read_bytes()).hexdigest() for v in ['baseline','candidate']}
assert [f for f,ids in identity['files'].items() if ids['baseline']!=ids['candidate']]==['types.ts']
(root/'source-identity.json').write_text(json.dumps(identity,indent=2))
