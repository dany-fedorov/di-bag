from pathlib import Path
import hashlib,json,shutil,subprocess,re

repo=Path('/tmp/di-bag-replacement-spike')
probe=Path('/tmp/di-bag-classic-depth-probe')
stage=Path('/tmp/di-bag-classic-depth-evidence')
stage.mkdir(exist_ok=True)
source='59d10c6c8ac13d63171f9f39c170da048d7e208c'
head='c9f8c181c53116c27c5411389af19773f5e802a6'
assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=repo,text=True).strip()==head
assert not subprocess.check_output(['git','status','--porcelain=v1'],cwd=repo,text=True).strip()
identity={'sourceCommit':source,'publicationCommit':head,'publication':'Source, tests and benchmark artifacts published in https://github.com/dany-fedorov/di-bag/pull/10; this package records a subsequent investigation.','productionFiles':{},'compilerInputs':{}}
for path in sorted((repo/'src').glob('*.ts')):
 data=path.read_bytes();assert data==subprocess.check_output(['git','show',source+':src/'+path.name],cwd=repo)
 identity['productionFiles'][path.name]=hashlib.sha256(data).hexdigest()
for name in ['tests/compiler.ts','scripts/compiler-case.ts','scripts/check-compiler-case.ts','package.json','package-lock.json']:
 data=(repo/name).read_bytes();assert data==subprocess.check_output(['git','show',source+':'+name],cwd=repo)
 identity['compilerInputs'][name]=hashlib.sha256(data).hexdigest()
compiler=Path('/tmp/di-bag-performance-integration/node_modules/@typescript/old/lib/typescript.js')
identity['classicCompilerSha256']=hashlib.sha256(compiler.read_bytes()).hexdigest()
assert identity['classicCompilerSha256']=='569177652966bd528c319171c7dd22860dbf72bde116cbc4f644f1d02bb12e39'
for name in ['types','di-bag','provider','module-types']:
 assert (probe/f'final-baseline.{name}.ts').read_bytes()==(repo/f'src/{name}.ts').read_bytes()
 if name!='di-bag':assert (probe/f'root-api-any.{name}.ts').read_bytes()==(repo/f'src/{name}.ts').read_bytes()
assert (probe/'root-api-any.di-bag.ts').read_text()==(repo/'src/di-bag.ts').read_text().replace('export const DiBag: Facade = facade(unconfigured);','export const DiBag: any = facade(unconfigured);')
(stage/'source-manifest.json').write_text(json.dumps(identity,indent=2)+'\n')
dest=stage/'probes';dest.mkdir(exist_ok=True)
for path in probe.iterdir():
 if path.is_file() and path.name!='instrumented-typescript.cjs':shutil.copyfile(path,dest/path.name)
original=stage/'original';original.mkdir(exist_ok=True)
measurements=repo/'docs/benchmarks/results/2026-09-10-entry-replacement-projections/measurements'
shutil.copyfile(measurements/'summary.json',original/'summary.json')
for path in measurements.glob('candidate-classic-1000-*'):
 if any(f'-{form}-' in path.name for form in ['chained','replacement']):shutil.copyfile(path,original/path.name)
review=Path('/tmp/di-bag-classic-depth-architecture-review.md').read_text()
(stage/'review-original.txt').write_text(review)
review=review.replace('/tmp/di-bag-classic-depth-probe/','probes/').replace('/tmp/di-bag-replacement-spike/docs/benchmarks/results/2026-09-10-entry-replacement-projections/measurements/summary.json','original/summary.json').replace('/tmp/di-bag-replacement-spike/node_modules/@typescript/old/lib/typescript.js:81626','compiler-excerpts.txt')
(stage/'review.md').write_text(review)
lines=compiler.read_text().splitlines();excerpts=[f'Installed TypeScript6.0.3 compiler SHA-256: {identity["classicCompilerSha256"]}', 'Read-only excerpts; line numbers refer to the authenticated installed JavaScript.']
for start,end in [(48325,48355),(79624,79630),(79700,79710),(81620,81660),(82242,82256),(82918,82963)]:
 excerpts+=['',f'Lines {start}-{end}:']+[f'{index+1}: {lines[index]}' for index in range(start-1,end)]
(stage/'compiler-excerpts.txt').write_text('\n'.join(excerpts)+'\n')
shutil.copyfile('/tmp/di-bag-classic-depth-stage.py',stage/'stage.py')
for name in ['README.md','upstream-issue-draft.md']:
 shutil.copyfile('/tmp/di-bag-classic-depth-'+name,stage/name)
files={str(path.relative_to(stage)):{'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'bytes':path.stat().st_size} for path in sorted(stage.rglob('*')) if path.is_file() and path!=stage/'artifact-manifest.json'}
(stage/'artifact-manifest.json').write_text(json.dumps({'sourceCommit':source,'files':files},indent=2)+'\n')
for path in stage.rglob('*.md'):
 for link in re.findall(r'\[[^\]]*\]\(([^)]+)\)',path.read_text()):
  if ':' not in link and not link.startswith(('#','/')):assert (path.parent/link.split('#')[0]).exists(),(path,link)
print(json.dumps({'stage':str(stage),'files':len(files)+1,'bytes':sum(x['bytes'] for x in files.values()),'publication':'local only'}))
