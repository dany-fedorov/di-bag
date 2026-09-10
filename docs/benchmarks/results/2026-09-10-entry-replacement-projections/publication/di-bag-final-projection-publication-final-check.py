from pathlib import Path, PurePosixPath
import json,hashlib,subprocess,math,re
repo=Path('/tmp/di-bag-replacement-spike');stage=Path('/tmp/di-bag-final-projection-evidence');origin=Path('/tmp/di-bag-final-projection-measurements')
sha=lambda b:hashlib.sha256(b).hexdigest();git=lambda *a:subprocess.check_output(['git','-C',str(repo),*a])
base='fb5fe6c736fc0c21b32b93dfc9e170c955209bb9';head='59d10c6c8ac13d63171f9f39c170da048d7e208c'
assert git('rev-parse','HEAD').decode().strip()==head
changed=git('diff','--name-only','HEAD').decode().splitlines();assert all(x.startswith('docs/') for x in changed),changed
identity=json.loads((stage/'source-manifest.json').read_text())
sourcehash={}
for label,commit in [('baseline',base),('candidate',head)]:
 h=hashlib.sha256()
 for name,ids in sorted(identity['productionFiles'].items()):
  b=git('show',commit+':src/'+name);assert sha(b)==ids[label];h.update(name.encode());h.update(b)
  if label=='candidate':assert b==(repo/'src'/name).read_bytes()
 sourcehash[label]=h.hexdigest()
assert not git('diff','HEAD','--','src','tests','scripts','package.json','package-lock.json').strip()
man=json.loads((stage/'artifact-manifest.json').read_text());assert man['sourceCommit']==head and man['baseline']==base
actual={str(p.relative_to(stage)):p for p in stage.rglob('*') if p.is_file() and p.name!='artifact-manifest.json'}
# Nested artifact manifests are ordinary checksummed artifact files.
actual={str(p.relative_to(stage)):p for p in stage.rglob('*') if p.is_file() and p!=stage/'artifact-manifest.json'}
assert set(actual)==set(man['files']),(set(actual)-set(man['files']),set(man['files'])-set(actual))
for name,entry in man['files'].items():
 p=PurePosixPath(name);assert not p.is_absolute() and '..' not in p.parts and not actual[name].is_symlink(),name
 raw=actual[name].read_bytes();assert sha(raw)==entry['sha256'] and len(raw)==entry['bytes'],name
measure=stage/'measurements';mf=json.loads((measure/'manifest.json').read_text());summary=json.loads((measure/'summary.json').read_text());completed=json.loads((measure/'collection-completed.json').read_text());rows=[json.loads(s) for s in (measure/'rows.jsonl').read_text().splitlines()]
for p in measure.iterdir():assert p.read_bytes()==(origin/p.name).read_bytes(),p.name
assert completed['completed'] is True and completed['cases']==40
assert summary['cases']==40 and summary['accepted']==34 and summary['failed']==6 and summary['baseline']==base and summary['candidate']==head and summary['sourceSha256']==sourcehash
expected={(s,l,500,f,'valid') for s in ['baseline','candidate'] for l in ['classic','native'] for f in ['chained','replacement','bindings','modules']}
expected|={('candidate',l,1000,f,s) for l in ['classic','native'] for f in ['chained','replacement','bindings','modules'] for s in (['valid','missing-final-token','mismatched-invariant-service'] if f in ['bindings','modules'] else ['valid','missing','wrong-shape'])}
by={(r['stage'],r['lane'],r['count'],r['form'],r['scenario']):r for r in rows};assert len(rows)==len(by)==40 and set(by)==expected
failures=[]
for key,row in by.items():
 s,l,n,f,c=key;e=row['evidence'];name='-'.join(map(str,key));commit=base if s=='baseline' else head
 assert json.loads((measure/(name+'.stdout.log')).read_text())==e,name
 assert (measure/(name+'.stderr.log')).read_text()=='',name
 assert e['sourceCommitBefore']==e['sourceCommitAfter']==e['sourceCommit']==commit,name
 assert e['sourceSha256Before']==e['sourceSha256After']==e['sourceSha256']==sourcehash[s],name
 assert e['sourceDirty'] is False and e['sourceStatusBefore']==e['sourceStatusAfter']==e['sourceStatus']=='',name
 assert e['generatedSha256Before']==e['generatedSha256After']==e['generatedSha256'],name
 assert e['typescript']==('6.0.3' if l=='classic' else '7.0.2'),name
 assert row['argv']==['node','--disable-warning=MODULE_TYPELESS_PACKAGE_JSON','scripts/check-compiler-case.ts',l,str(n),f,c],name
 assert row['status']==(0 if e['accepted'] else 1),name
 if not e['accepted']:
  assert l=='classic' and n==1000 and f in ['chained','replacement'] and 'RangeError: Maximum call stack size exceeded' in e['stderr'],name
  failures.append({'form':f,'scenario':c,'lane':l,'reason':'compiler stack overflow'})
 else:
  assert not e.get('terminationReason') and not e.get('error') and e.get('signal') is None,name
  assert e['processMilliseconds']<61000,name
  if l=='native':assert e['checked'] and e['peakObservedRssMiB']<=3072,name
assert len(failures)==6 and sum(r['evidence']['accepted'] for r in rows)==34
work=lambda e:e.get('instantiations') or e['nativeMetrics']['Instantiations']
rss=lambda e:e.get('maxRssMiB',e.get('peakObservedRssMiB'))
readme=(stage/'README.md').read_text();tablechecks=[]
for f in ['chained','replacement','bindings','modules']:
 cells=[]
 for l in ['classic','native']:
  b=by['baseline',l,500,f,'valid']['evidence'];a=by['candidate',l,500,f,'valid']['evidence'];assert b['generatedSha256']==a['generatedSha256']
  reduction=(work(b)-work(a))/work(b)*100;derived=next(x for x in summary['comparisons'] if x['form']==f and x['lane']==l)
  assert derived['beforeInstantiations']==work(b) and derived['afterInstantiations']==work(a) and math.isclose(derived['reductionPercent'],reduction,rel_tol=1e-14)
  assert derived['beforeProcessMilliseconds']==b['processMilliseconds'] and derived['afterProcessMilliseconds']==a['processMilliseconds']
  assert derived['beforeMaxRssMiB']==rss(b) and derived['afterMaxRssMiB']==rss(a)
  cells.append(f'{work(b):,} → {work(a):,} ({-reduction:+.3f}%)')
  time=f'| {f} | {l} | {b["processMilliseconds"]/1000:.3f} → {a["processMilliseconds"]/1000:.3f} s | {rss(b):.2f} → {rss(a):.2f} MiB |';assert time in readme,time;tablechecks.append(time)
 text=f'| {f} | {cells[0]} | {cells[1]} |';assert text in readme,text;tablechecks.append(text)
for d in summary['original1000']:
 e=by['candidate',d['lane'],1000,d['form'],d['scenario']]['evidence'];assert d['accepted']==e['accepted'] and d['processMilliseconds']==e['processMilliseconds'] and d['maxRssMiB']==rss(e)
 if d['accepted']:assert d['instantiations']==work(e)
 else:assert d['reason']=='compiler stack overflow'
 message=('zero diagnostics' if d['scenario']=='valid' else 'intended boundary error; no TS2589') if d['accepted'] else d['reason'];mem=f'{rss(e):.2f} MiB' if isinstance(rss(e),(float,int)) else 'unavailable'
 text=f'| {d["form"]} | {d["scenario"]} | {d["lane"]} | {"yes" if d["accepted"] else "no"} | {message} | {e["processMilliseconds"]/1000:.3f} s | {mem} |';assert text in readme,text;tablechecks.append(text)
assert len(summary['original1000'])==24 and len(tablechecks)==36
assert '40 rows: 34 accepted and 6 failed' in readme and '108-row matrix' in readme and 'does not relabel or claim a rerun' in readme
assert 'heap' in readme and 'sampled RSS' in readme and 'old-space' in readme
assert 'heap' in mf['limits'] and 'RSS' in mf['limits']
for label,paths in mf['sourceFiles'].items():
 for p,h in paths.items():assert identity['productionFiles'][p.removeprefix('src/')][label]==h
for link in re.findall(r'\]\(([^)]+)\)',readme):
 if link.startswith(('http://','https://','#')):continue
 assert (stage/link.split('#')[0]).exists(),link
result={'sourceCommit':head,'baseline':base,'sourceHashes':sourcehash,'artifactFiles':len(man['files'])+1,'checksumsVerified':len(man['files']),'artifactBytesExcludingManifest':sum(x['bytes'] for x in man['files'].values()),'manifestSha256':sha((stage/'artifact-manifest.json').read_bytes()),'rows':40,'accepted':34,'failed':6,'classicStackFailures':failures,'native1000Accepted':sum(r['lane']=='native' and r['count']==1000 and r['evidence']['accepted'] for r in rows),'bindingsModules1000Accepted':sum(r['count']==1000 and r['form'] in ['bindings','modules'] and r['evidence']['accepted'] for r in rows),'tableRowsChecked':len(tablechecks),'laneSpecificLimitsDescribed':True,'docsOnlyChangesAtFinalAudit':changed}
Path('/tmp/di-bag-final-projection-publication-final.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
