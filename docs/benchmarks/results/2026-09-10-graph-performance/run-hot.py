from pathlib import Path
import hashlib,json,subprocess,statistics
root=Path(__file__).resolve().parent
rows=[]
with (root/'hot-commands.jsonl').open('w') as out:
 for count in [100,1000,5000]:
  for sample in range(3):
   for compiler in ['classic','native']:
    for phase in ['before','after']:
     args=['timeout','30s','node','--expose-gc','--max-old-space-size=512',str(root/'hot-probe.mjs'),f'/tmp/di-bag-graph-{phase}/{compiler}/node.js',str(count),str(sample)]
     r=subprocess.run(args,text=True,capture_output=True)
     out.write(json.dumps({'build':compiler+'-'+phase,'argv':args,'exitStatus':r.returncode,'stdout':r.stdout,'stderr':r.stderr})+'\n');out.flush()
     try: row=json.loads(r.stdout)
     except json.JSONDecodeError: row={'count':count,'sample':sample,'parseError':True}
     rows.append({'build':compiler+'-'+phase,'exitStatus':r.returncode,**row})
(root/'hot-rows.jsonl').write_text(''.join(json.dumps(r)+'\n' for r in rows))
summary=[]
for count in [100,1000,5000]:
 for compiler in ['classic','native']:
  for phase in ['before','after']:
   selected=[r for r in rows if r['count']==count and r['build']==compiler+'-'+phase]
   row={'count':count,'build':compiler+'-'+phase,'successes':sum(r['exitStatus']==0 and not r.get('parseError') for r in selected)}
   for metric in ['directMs','proxyMs']:
    if all(metric in r for r in selected):row[metric]={'min':min(r[metric] for r in selected),'median':statistics.median(r[metric] for r in selected),'max':max(r[metric] for r in selected)}
   summary.append(row)
(root/'hot-summary.json').write_text(json.dumps(summary,indent=2)+'\n')
(root/'hot-probe-hashes.json').write_text(json.dumps({p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in [root/'hot-probe.mjs',Path(__file__)]},indent=2)+'\n')
