from pathlib import Path
import hashlib, json, subprocess, statistics, sys
root=Path(__file__).resolve().parent
repo=root.parents[3]
phase=sys.argv[1]
builds={f'{compiler}-{phase}':Path(f'/tmp/di-bag-graph-{phase}/{compiler}') for compiler in ['classic','native']}
def hashes(path): return {p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(path.iterdir()) if p.is_file()}
base='56e502e125fd29760f03493ea4b16f126edb145e'
source=Path('/tmp/di-bag-graph-before/src') if phase=='before' else repo/'src'
if phase=='before':
 for p in source.glob('*.ts'): assert p.read_bytes()==subprocess.check_output(['git','show',f'{base}:src/{p.name}'],cwd=repo)
manifest={'base':base,'node':subprocess.check_output(['node','-v'],text=True).strip(),'classic':subprocess.check_output([str(repo/'node_modules/.bin/tsc6'),'--version'],text=True).strip(),'native':subprocess.check_output([str(repo/'node_modules/.bin/tsc'),'--version'],text=True).strip(),'source':hashes(source),'builds':{k:{'path':str(p),'hashes':hashes(p)} for k,p in builds.items()},'probes':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in [root/'original-probe.mjs',root/'graph-probe.mjs',Path(__file__)]}}
(root/f'manifest-{phase}.json').write_text(json.dumps(manifest,indent=2)+'\n')
cases=[('original-probe.mjs',s,n) for s in ['build-incremental','replace-history','scope-override','module-install','warm-proxy'] for n in [100,1000,5000]]
cases += [('graph-probe.mjs',s,n) for s in ['bulk-strings','bulk-tokens','incremental-strings','incremental-tokens','replacement-memory','contribution-append','contribution-cached-memory','retained-versions'] for n in [100,1000,5000]]
rows=[]
with (root/f'commands-{phase}.jsonl').open('w') as commands,(root/f'rows-{phase}.jsonl').open('w') as out:
 for probe,scenario,count in cases:
  for sample in range(3):
   for build,path in builds.items():
    args=['timeout','30s','node','--expose-gc','--max-old-space-size=512',str(root/probe),str(path/'node.js'),scenario,str(count),str(sample)]
    result=subprocess.run(args,cwd=repo,text=True,capture_output=True)
    commands.write(json.dumps({'build':build,'argv':args,'exitStatus':result.returncode,'stdout':result.stdout,'stderr':result.stderr})+'\n');commands.flush()
    try: row=json.loads(result.stdout)
    except json.JSONDecodeError: row={'scenario':scenario,'count':count,'sample':sample,'parseError':True}
    row={'build':build,'exitStatus':result.returncode,**row};rows.append(row);out.write(json.dumps(row)+'\n');out.flush()
  print(scenario,count,'recorded',flush=True)
summary=[]
for _,scenario,count in cases:
 for build in builds:
  selected=[r for r in rows if r['scenario']==scenario and r['count']==count and r['build']==build]
  row={'build':build,'scenario':scenario,'count':count,'samples':len(selected),'successes':sum(r['exitStatus']==0 and not r.get('parseError') and 'error' not in r for r in selected)}
  for key in ['elapsedMs','incrementalMs','bulkMs','installMs','plainMs','overrideMs','proxyMs','directMs','retainedHeapBytes']:
   if all(key in r for r in selected): row[key]={'min':min(r[key] for r in selected),'median':statistics.median(r[key] for r in selected),'max':max(r[key] for r in selected)}
  summary.append(row)
(root/f'summary-{phase}.json').write_text(json.dumps(summary,indent=2)+'\n')
