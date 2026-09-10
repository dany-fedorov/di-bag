from pathlib import Path
import json,hashlib
root=Path('/tmp/di-bag-dependency-checks-measurements');manifest=json.loads((root/'manifest.json').read_text());completed=json.loads((root/'collection-completed.json').read_text());assert completed['completed'] and completed['cases']==24
rows=[json.loads(x) for x in (root/'rows.jsonl').read_text().splitlines()]
expected={(stage,lane,500,form) for stage in ('baseline','candidate') for lane in ('classic','native') for form in ('chained','replacement','bindings','modules')}|{('candidate',lane,1000,form) for lane in ('classic','native') for form in ('chained','replacement','bindings','modules')}
by={(x['stage'],x['lane'],x['count'],x['form']):x for x in rows};assert len(rows)==len(by)==24 and set(by)==expected
sourcehash={}
for stage,paths in manifest['sourceFiles'].items():
 currentroot=Path(manifest['roots'][stage]);sha=hashlib.sha256()
 for name,value in sorted(paths.items()):
  data=(currentroot/name).read_bytes();assert hashlib.sha256(data).hexdigest()==value;sha.update(name.removeprefix('src/').encode());sha.update(data)
 sourcehash[stage]=sha.hexdigest()
def work(e):return e.get('instantiations') or e.get('nativeMetrics',{}).get('Instantiations')
def reason(e):
 if e.get('accepted'):return 'accepted'
 if e.get('terminationReason'):return e['terminationReason']
 if any(d.get('code')==2589 for d in (e.get('diagnostics') or [])):return 'TS2589'
 if 'RangeError' in (e.get('stderr') or ''):return 'compiler stack overflow'
 if 'ETIMEDOUT' in (e.get('error') or ''):return 'worker timeout'
 return e.get('failureReason','unclassified failure; inspect raw row')
for row in rows:
 e=row['evidence'];stage=row['stage'];assert e['sourceCommitBefore']==e['sourceCommitAfter']==manifest['expectedHeads'][stage];assert not e['sourceDirty'];assert e['sourceSha256Before']==e['sourceSha256After']==sourcehash[stage];assert e['generatedSha256Before']==e['generatedSha256After'];assert e['typescript']==('6.0.3' if row['lane']=='classic' else '7.0.2');assert row['status']==(0 if e['accepted'] else 1)
comparisons=[]
for form in ('chained','replacement','bindings','modules'):
 for lane in ('classic','native'):
  before=by['baseline',lane,500,form]['evidence'];after=by['candidate',lane,500,form]['evidence'];assert before['accepted'] and after['accepted'];assert before['generatedSha256']==after['generatedSha256'];b=work(before);a=work(after);assert isinstance(a,int) and isinstance(b,int) and 0<a<b
  comparisons.append({'form':form,'lane':lane,'count':500,'beforeInstantiations':b,'afterInstantiations':a,'reductionPercent':(b-a)/b*100,'beforeMilliseconds':before.get('milliseconds'),'afterMilliseconds':after.get('milliseconds'),'beforeProcessMilliseconds':before['processMilliseconds'],'afterProcessMilliseconds':after['processMilliseconds'],'beforeMaxRssMiB':before.get('maxRssMiB',before.get('peakObservedRssMiB')),'afterMaxRssMiB':after.get('maxRssMiB',after.get('peakObservedRssMiB')),'beforeNativeMemoryKiB':before.get('nativeMetrics',{}).get('Memory used'),'afterNativeMemoryKiB':after.get('nativeMetrics',{}).get('Memory used')})
large=[{'form':row['form'],'lane':row['lane'],'accepted':row['evidence']['accepted'],'reason':reason(row['evidence']),'processMilliseconds':row['evidence']['processMilliseconds'],'sourceCommit':row['evidence']['sourceCommit']} for row in rows if row['count']==1000]
summary={'baseline':manifest['expectedHeads']['baseline'],'candidate':manifest['expectedHeads']['candidate'],'cases':len(rows),'accepted':sum(x['evidence']['accepted'] for x in rows),'failed':sum(not x['evidence']['accepted'] for x in rows),'sourceSha256':sourcehash,'comparisons':comparisons,'original1000':large}
(root/'summary.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps(summary,indent=2))
