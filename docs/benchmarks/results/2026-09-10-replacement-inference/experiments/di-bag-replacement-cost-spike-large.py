from pathlib import Path
import fcntl,json,subprocess,time
root=Path('/tmp/di-bag-replacement-spike'); out=Path('/tmp/di-bag-replacement-cost-spike')
builder=root/'src/di-bag.ts'; original=builder.read_text()
rows=[]
with open('/tmp/di-bag-compiler-heavy.lock','a') as lock:
 fcntl.flock(lock,fcntl.LOCK_EX)
 try:
  for variant in ['baseline','noinfer-history-PROTOTYPE']:
   builder.write_text(original if variant=='baseline' else original.replace('ReplacementOutput<From<E>, K, C>','ReplacementOutput<NoInfer<From<E>>, K, C>'))
   for lane,count in [('classic',500),('native',500),('native',1000)]:
    argv=['node','--disable-warning=MODULE_TYPELESS_PACKAGE_JSON','scripts/check-compiler-case.ts',lane,str(count),'replacement','valid']
    start=time.monotonic(); child=subprocess.run(argv,cwd=root,text=True,capture_output=True,timeout=100)
    case=out/variant/f'{lane}-{count}';case.mkdir(exist_ok=True)
    (case/'stdout.log').write_text(child.stdout);(case/'stderr.log').write_text(child.stderr)
    result=json.loads(child.stdout) if child.stdout.startswith('{') else None
    row={'variant':variant,'lane':lane,'count':count,'status':child.returncode,'seconds':time.monotonic()-start,'argv':argv,'result':result}
    rows.append(row)
    (out/'large-rows.json').write_text(json.dumps(rows,indent=2)+'\n')
    print(json.dumps({**{k:v for k,v in row.items() if k!='result'},'accepted':result and result.get('accepted'),'instantiations':result and result.get('instantiations',result.get('metrics',{}).get('Instantiations')),'failureReason':result and result.get('failureReason')}),flush=True)
 finally:
  builder.write_text(original)
