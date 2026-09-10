from pathlib import Path
import hashlib,json,subprocess,statistics
root=Path(__file__).resolve().parent
rows=[]
with (root/'module-commands-after.jsonl').open('w') as out:
 for scenario in ['module-local-incremental','module-local-contribution']:
  for count in [100,1000,5000]:
   for compiler in ['classic','native']:
    for sample in range(3):
     args=['timeout','30s','node','--expose-gc','--max-old-space-size=512',str(root/'module-probe.mjs'),f'/tmp/di-bag-graph-after/{compiler}/node.js',scenario,str(count),str(sample)]
     r=subprocess.run(args,text=True,capture_output=True)
     out.write(json.dumps({'build':compiler+'-after','argv':args,'exitStatus':r.returncode,'stdout':r.stdout,'stderr':r.stderr})+'\n');out.flush()
     try: row=json.loads(r.stdout)
     except json.JSONDecodeError: row={'scenario':scenario,'count':count,'sample':sample,'parseError':True}
     rows.append({'build':compiler+'-after','exitStatus':r.returncode,**row})
(root/'module-rows-after.jsonl').write_text(''.join(json.dumps(r)+'\n' for r in rows))
summary=[]
for scenario in ['module-local-incremental','module-local-contribution']:
 for count in [100,1000,5000]:
  for compiler in ['classic','native']:
   selected=[r for r in rows if r['scenario']==scenario and r['count']==count and r['build']==compiler+'-after']
   row={'scenario':scenario,'count':count,'build':compiler+'-after','successes':sum(r['exitStatus']==0 and not r.get('parseError') for r in selected)}
   for metric in ['elapsedMs','retainedHeapBytes']:
    if all(metric in r for r in selected):row[metric]={'min':min(r[metric] for r in selected),'median':statistics.median(r[metric] for r in selected),'max':max(r[metric] for r in selected)}
   summary.append(row)
(root/'module-summary-after.json').write_text(json.dumps(summary,indent=2)+'\n')
(root/'module-probe-hashes-after.json').write_text(json.dumps({p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in [root/'module-probe.mjs',Path(__file__)]},indent=2)+'\n')
