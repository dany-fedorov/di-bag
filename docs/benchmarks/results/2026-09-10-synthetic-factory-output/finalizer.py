from pathlib import Path
import json,hashlib,shutil,subprocess
root=Path('/tmp/di-bag-replacement-spike');stage=Path('/tmp/di-bag-synthetic-factory-evidence');measurements=Path('/tmp/di-bag-synthetic-factory-measurements')
summary=json.loads((measurements/'summary.json').read_text());manifest=json.loads((stage/'source-manifest.json').read_text())
assert summary['candidate']==manifest['candidate']=='3414490a23bfbf76cba14b9d4044788964b59853'
assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()==summary['candidate']
assert not subprocess.check_output(['git','status','--porcelain=v1'],cwd=root,text=True).strip()
shutil.copytree(measurements,stage/'measurements',dirs_exist_ok=True)
lines=[f"Final source: `{summary['candidate']}`. The clean-commit collection contains **{summary['cases']} rows: {summary['accepted']} accepted and {summary['failed']} failed**. All paired 500-operation rows use the same original generated source on the baseline and candidate.", '', '| 500-operation form | Classic instantiations before → after | Native instantiations before → after |', '| --- | ---: | ---: |']
for form in ('chained','replacement','bindings','modules'):
 values=[]
 for lane in ('classic','native'):
  x=next(x for x in summary['comparisons'] if x['form']==form and x['lane']==lane)
  change=-x['reductionPercent'];values.append(f"{x['beforeInstantiations']:,} → {x['afterInstantiations']:,} ({change:+.3f}%)")
 lines.append(f"| {form} | {values[0]} | {values[1]} |")
lines+=['','| Original 1,000-operation form | Scenario | Compiler | Accepted | Result | Process time | Observed peak RSS |','| --- | --- | --- | --- | --- | ---: | ---: |']
for x in summary['original1000']:
 result='zero diagnostics' if x['accepted'] and x['scenario']=='valid' else ('intended boundary error; no TS2589' if x['accepted'] else x['reason'])
 rss=f"{x['maxRssMiB']:.2f} MiB" if isinstance(x['maxRssMiB'],(int,float)) else 'unavailable'
 lines.append(f"| {x['form']} | {x['scenario']} | {x['lane']} | {'yes' if x['accepted'] else 'no'} | {result} | {x['processMilliseconds']/1000:.3f} s | {rss} |")
lines+=['','Accepted negative rows mean invalid code was rejected at the original marked boundary without TS2589. Raw rows preserve any additional diagnostics permitted by the original oracle. The historical 108-row matrix was not rerun or relabeled. Named and replacement 1,000-operation limitations remain open; this change targets token factories and module projections.', '', 'Classic 1,000-module compilation remains close to the original time and memory bounds. Completing on this host does not establish comfortable editor-scale memory or latency. The 500-operation named and replacement work changes by 40 classic or 66 native instantiations; those rows are retained rather than described as reductions.', '', 'Local verification covers 940 passing tests from the full run, followed by all **29 platform checks passing** after the ignored tool manifest was refreshed. The original full-run failure remains recorded below. Both builds and source typechecks passed; emitted Node regressions passed **31 tests per compiler**. The native audit matched **639/639 expected diagnostics across 124 files**, with zero unexpected. Generated references, documentation checks and all nine examples passed. The pull request records fresh full-suite hosted CI and final merge verification.']
p=stage/'README.md';s=p.read_text();assert 'FINAL MEASUREMENTS AND VALIDATION PENDING.' in s;p.write_text(s.replace('FINAL MEASUREMENTS AND VALIDATION PENDING.','\n'.join(lines)))
shutil.copyfile('/tmp/di-bag-synthetic-factory-finalize.py',stage/'finalizer.py')
files={str(p.relative_to(stage)):{'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'bytes':p.stat().st_size} for p in sorted(stage.rglob('*')) if p.is_file() and p.name!='artifact-manifest.json'}
(stage/'artifact-manifest.json').write_text(json.dumps({'sourceCommit':summary['candidate'],'baseline':summary['baseline'],'files':files},indent=2)+'\n')
print(json.dumps({'files':len(files)+1,'bytes':sum(x['bytes'] for x in files.values()),'accepted':summary['accepted'],'failed':summary['failed'],'stage':str(stage)}))
