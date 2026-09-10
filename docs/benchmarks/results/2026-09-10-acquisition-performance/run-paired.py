from pathlib import Path
import hashlib, json, subprocess, statistics

root = Path(__file__).resolve().parent
repo = root.parents[3]
base = '6771cb413ab02ef541e273543292ee1352438db7'
baseline_source = Path('/tmp/di-bag-performance-first-fixes-baseline/src')
source = repo / 'src'
def hashes(directory):
    return {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(directory.iterdir()) if p.is_file()}
builds = {
    'classic-before': Path('/tmp/di-bag-performance-fixed-main-classic'),
    'classic-after': Path('/tmp/di-bag-acquisition-after-classic'),
    'native-before': Path('/tmp/di-bag-performance-first-fixes-baseline/dist'),
    'native-after': Path('/tmp/di-bag-acquisition-after-native'),
}
for path in baseline_source.glob('*.ts'):
    assert path.read_bytes() == subprocess.check_output(['git', 'show', f'{base}:src/{path.name}'], cwd=repo), path
manifest = {
    'baseCommit': base,
    'baselineSourceVerifiedAgainstBase': True,
    'node': subprocess.check_output(['node', '--version'], text=True).strip(),
    'classicCompiler': subprocess.check_output([str(repo / 'node_modules/.bin/tsc6'), '--version'], text=True).strip(),
    'nativeCompiler': subprocess.check_output([str(repo / 'node_modules/.bin/tsc'), '--version'], text=True).strip(),
    'baselineSource': hashes(baseline_source), 'afterSource': hashes(source),
    'builds': {key: {'directory': str(path), 'sha256': hashes(path)} for key, path in builds.items()},
    'probes': {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in [root/'original-probe.mjs', root/'acquisition-probe.mjs', Path(__file__)]},
    'tests': {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in [repo/'tests/acquisition-retention.node.mjs', repo/'tests/runtime-scale.node.mjs']},
    'execution': 'Serial fresh processes; three samples; no stack-size override; 30-second timeout; 512 MiB heap limit. Cold overflow rows are preserved, including successful process exits containing error records.',
}
(root/'manifest.json').write_text(json.dumps(manifest, indent=2)+'\n')
cases = [('original-probe.mjs', 'transient-memory', 10000)]
cases += [('original-probe.mjs', 'cold-chain', count) for count in [100,500,1000,1500,2000,4000]]
cases += [('acquisition-probe.mjs', 'cold-chain-auto', count) for count in [100,500,1000,1500,2000,4000]]
cases += [('acquisition-probe.mjs', scenario, 10000) for scenario in ['transient-history-memory', 'transient-native-memory', 'transient-mapped-memory', 'cleanup-control']]
observations=[]
with (root/'commands.jsonl').open('w') as commands, (root/'observations.jsonl').open('w') as rows:
    for probe, scenario, count in cases:
        for sample in range(3):
            for build, directory in builds.items():
                args=['timeout','30s','node','--expose-gc','--max-old-space-size=512',str(root/probe),str(directory/'node.js'),scenario,str(count),str(sample)]
                result=subprocess.run(args, cwd=repo, text=True, capture_output=True)
                commands.write(json.dumps({'build':build,'argv':args,'exitStatus':result.returncode,'stdout':result.stdout,'stderr':result.stderr})+'\n'); commands.flush()
                try: observation=json.loads(result.stdout)
                except json.JSONDecodeError: observation={'scenario':scenario,'count':count,'sample':sample,'parseError':True}
                observation={'build':build,'exitStatus':result.returncode,**observation}
                rows.write(json.dumps(observation)+'\n'); rows.flush(); observations.append(observation)
        print(scenario,count,'recorded',flush=True)
summary=[]
for probe,scenario,count in cases:
    for build in builds:
        selected=[r for r in observations if r['scenario']==scenario and r['count']==count and r['build']==build]
        row={'build':build,'scenario':scenario,'count':count,'samples':len(selected),'successes':sum(r['exitStatus']==0 and 'error' not in r and not r.get('parseError') for r in selected)}
        for key in ['elapsedMs','retainedHeapBytes','afterCloseHeapBytes','retainedAcquisitions','retainedPayloads','created','projected','disposed']:
            if all(key in r for r in selected): row[key]={'min':min(r[key] for r in selected),'median':statistics.median(r[key] for r in selected),'max':max(r[key] for r in selected)}
        summary.append(row)
(root/'summary.json').write_text(json.dumps(summary,indent=2)+'\n')
