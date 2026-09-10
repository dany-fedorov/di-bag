"""Reconcile every original row and preserve exact failures in a compact index."""
import collections, hashlib, json
from pathlib import Path
base=Path(__file__).resolve().parent
root=base.parents[3]
def records(path):return [json.loads(s) for s in path.read_text().splitlines()]
rows=records(base/'final-matrix/rows.jsonl');commands=records(base/'final-matrix/commands.jsonl')
expected={(lane,count,form,scenario) for lane in ['classic','native'] for count in [100,500,1000] for form in ['bulk','chained','grouped','replacement','bindings','modules'] for scenario in (['valid','missing-final-token','mismatched-invariant-service'] if form in ['bindings','modules'] else ['valid','missing','wrong-shape'])}
identity=lambda r:(r['lane'],r['count'],r['form'],r['scenario'])
assert len(rows)==len(commands)==108 and {identity(r) for r in rows}==expected
h=hashlib.sha256()
for p in sorted((root/'src').rglob('*.ts')):
 h.update(str(p.relative_to(root/'src')).encode());h.update(p.read_bytes())
source=h.hexdigest()
for r,c in zip(rows,commands):
 assert json.loads(c['stdout'])==r
 assert not c['stderr'] and not c['outerTimeout']
 assert c['status']==(0 if r['accepted'] else 1)
 assert r['sourceSha256Before']==r['sourceSha256After']==source
 assert r['sourceCommitBefore']==r['sourceCommitAfter']
 assert r['sourceStatusBefore']==r['sourceStatusAfter']
 assert r['generatedSha256Before']==r['generatedSha256After']
for r in rows:
 peer=next(x for x in rows if x['lane']!=r['lane'] and identity(x)[1:]==identity(r)[1:])
 assert r['generatedSha256Before']==peer['generatedSha256Before']
before=records(base/'before/rows.jsonl')
for b in before:
 r=next(r for r in rows if identity(r)==identity(b))
 assert r['generatedSha256Before']==b['generatedSha256Before']
def work(r):return r.get('instantiations',r.get('nativeMetrics',{}).get('Instantiations'))
def compile_ms(r):
 if r['lane']=='classic':return r.get('milliseconds')
 value=r.get('nativeMetrics',{}).get('Total time')
 return value*1000 if value is not None else None
def rss(r):return r.get('peakObservedRssMiB',r.get('maxRssMiB'))
def reason(r):
 if 'RangeError' in r.get('stderr',''):return 'RangeError: '+r['stderr'].split('RangeError:',1)[1].split('\n')[0].strip()
 if r.get('terminationReason'):return r['terminationReason']
 if 'ETIMEDOUT' in r.get('error',''):return 'timeout'
 if any(d['code']==2589 for d in r.get('diagnostics',[])):return 'TS2589'
 return r.get('failureReason','unknown failure')
groups=[]
for lane in ['classic','native']:
 for family in ['named','tokens']:
  selected=[r for r in rows if r['lane']==lane and (r['form'] in ['bindings','modules'])==(family=='tokens')]
  groups.append({'lane':lane,'family':family,'accepted':sum(r['accepted'] for r in selected),'rows':len(selected)})
comparisons=[]
for b in before:
 r=next(r for r in rows if identity(r)==identity(b))
 comparisons.append({'identity':identity(r),'beforeAccepted':b['accepted'],'afterAccepted':r['accepted'],'beforeWork':work(b),'afterWork':work(r),'reductionPercent':100*(1-work(r)/work(b)) if b['accepted'] and r['accepted'] else None,'beforeCompilerMilliseconds':compile_ms(b),'afterCompilerMilliseconds':compile_ms(r),'beforeRssMiB':rss(b),'afterRssMiB':rss(r)})
controls=[]
for folder,context in [('controls','script'),('module-controls','external-module')]:
 cases=records(base/folder/'commands.jsonl')
 assert len(cases)==24
 for c in cases:
  wrapper=json.loads(c['stdout']);v={}
  try:v=json.loads(wrapper['stdout'])
  except ValueError:pass
  controls.append({'context':context,'identity':[c[k] for k in ['lane','count','form','kind']],'accepted':wrapper['status']==0 and wrapper['signal'] is None and not wrapper['stderr'] and v.get('accepted') is True,'workerStatus':wrapper['status'],'workerSignal':wrapper['signal'],'terminationReason':v.get('terminationReason'),'reason':wrapper.get('error') or (wrapper['stderr'].splitlines()[0] if wrapper['stderr'] else None),'diagnostics':v.get('diagnostics'),'instantiations':v.get('instantiations',v.get('metrics',{}).get('Instantiations')),'generatedSha256':c['generatedSha256']})
summary={'sourceSha256':source,'rows':108,'accepted':sum(r['accepted'] for r in rows),'groups':groups,'failed':[{'identity':identity(r),'reason':reason(r),'codes':[d['code'] for d in r.get('diagnostics',[])]} for r in rows if not r['accepted']],'comparisons':comparisons,'controls':controls,'gates':records(base/'gates/commands.jsonl')}
assert all(g['status']==0 for g in summary['gates'])
(base/'summary.json').write_text(json.dumps(summary,indent=2)+'\n')
print(json.dumps({k:summary[k] for k in ['sourceSha256','rows','accepted','groups','failed']},indent=2))
