import subprocess,fcntl,time,json,os,sys
from pathlib import Path
root=Path('/tmp/di-bag-replacement-spike');prefix=Path('/tmp/di-bag-final-projection-integration');env=dict(os.environ);env['npm_config_update_notifier']='false';env['PATH']='/tmp/di-bag-bun-1.4.0/bun-linux-x64:'+env['PATH']
node=['node','--expose-gc','--test','--test-isolation=none','tests/runtime-scale.node.mjs','tests/acquisition-retention.node.mjs','tests/graph-retention.node.mjs']
steps=[('platform-pin',['npm','run','platform:pin']),('full-check',['npm','run','check']),('classic-node',node),('native-typecheck',['npm','run','typecheck:native']),('native-build',['npm','run','build:native']),('native-node',node),('native-audit',['npm','run','check:native']),('docs-generate',['npm','run','docs:generate']),('docs-check',['npm','run','docs:check'])]
steps += [('example-'+p.stem,['bun','run',str(p)]) for p in sorted(Path(root/'examples').glob('*.ts'))]
rows=[]
for name,args in steps:
 with open('/tmp/di-bag-compiler-heavy.lock','a') as lock:
  fcntl.flock(lock,fcntl.LOCK_EX)
  log=Path(str(prefix)+'-'+name+'.log');start=time.monotonic()
  with log.open('w') as out:r=subprocess.run(args,cwd=root,env=env,stdout=out,stderr=subprocess.STDOUT)
  row={'step':name,'argv':args,'status':r.returncode,'seconds':time.monotonic()-start,'log':str(log)};rows.append(row);Path(str(prefix)+'-verification.json').write_text(json.dumps(rows,indent=2)+'\n');print(json.dumps(row),flush=True)
  if r.returncode:sys.exit(r.returncode)
