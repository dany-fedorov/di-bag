import subprocess,json,hashlib,fcntl,time,sys
from pathlib import Path
roots={'baseline':Path('/tmp/di-bag-replacement-performance'),'candidate':Path('/tmp/di-bag-replacement-spike')}
out=Path('/tmp/di-bag-synthetic-factory-measurements');out.mkdir(exist_ok=True)
expected={'baseline':'c058be3e4c2852c768a68591c94893ba75776a1c','candidate':sys.argv[1]}
def git(root,*args):return subprocess.check_output(['git',*args],cwd=root,text=True).strip()
plans=[(stage,lane,500,form,'valid') for form in ('chained','replacement','bindings','modules') for lane in ('classic','native') for stage in ('baseline','candidate')]+[('candidate',lane,1000,form,'valid') for form in ('chained','replacement','bindings','modules') for lane in ('classic','native')]
plans += [('candidate',lane,1000,form,scenario) for form in ('bindings','modules') for lane in ('classic','native') for scenario in ('missing-final-token','mismatched-invariant-service')]
manifest={'roots':{k:str(v) for k,v in roots.items()},'expectedHeads':expected,'cases':len(plans),'limits':'original check-compiler-case.ts: 60 seconds, 3072 MiB, 4 MiB output, default stacks','sourceFiles':{}}
with open('/tmp/di-bag-compiler-heavy.lock','a') as lock:
 fcntl.flock(lock,fcntl.LOCK_EX)
 for stage,root in roots.items():
  assert git(root,'rev-parse','HEAD')==expected[stage]
  assert not git(root,'status','--porcelain=v1')
  manifest['sourceFiles'][stage]={str(f.relative_to(root)):hashlib.sha256(f.read_bytes()).hexdigest() for f in sorted((root/'src').rglob('*.ts'))}
 assert not git(roots['candidate'],'diff','--name-only',expected['baseline'],expected['candidate'],'--','scripts','tests/compiler.ts','package.json','package-lock.json')
 (out/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
 with (out/'rows.jsonl').open('w') as rows:
  for stage,lane,count,form,scenario in plans:
   root=roots[stage];assert git(root,'rev-parse','HEAD')==expected[stage];assert not git(root,'status','--porcelain=v1')
   name=f'{stage}-{lane}-{count}-{form}-{scenario}';argv=['node','--disable-warning=MODULE_TYPELESS_PACKAGE_JSON','scripts/check-compiler-case.ts',lane,str(count),form,scenario];start=time.monotonic()
   result=subprocess.run(argv,cwd=root,text=True,capture_output=True)
   (out/(name+'.stdout.log')).write_text(result.stdout);(out/(name+'.stderr.log')).write_text(result.stderr)
   try: evidence=json.loads(result.stdout)
   except json.JSONDecodeError:evidence=None
   row={'stage':stage,'lane':lane,'count':count,'form':form,'scenario':scenario,'argv':argv,'status':result.returncode,'seconds':time.monotonic()-start,'evidence':evidence}
   rows.write(json.dumps(row)+'\n');rows.flush()
   print(json.dumps({'case':name,'status':result.returncode,'accepted':evidence.get('accepted') if evidence else None,'instantiations':(evidence.get('instantiations') or evidence.get('nativeMetrics',{}).get('Instantiations')) if evidence else None}),flush=True)
   assert git(root,'rev-parse','HEAD')==expected[stage] and not git(root,'status','--porcelain=v1')
   if evidence is None:raise RuntimeError('missing structured compiler evidence; raw output retained')
   assert evidence['sourceCommitBefore']==expected[stage] and not evidence['sourceDirty']
   assert evidence['sourceSha256Before']==evidence['sourceSha256After']
 (out/'collection-completed.json').write_text(json.dumps({'cases':len(plans),'completed':True,'note':'Collection completion does not imply fixture acceptance.'},indent=2)+'\n')
