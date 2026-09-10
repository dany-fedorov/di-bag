import subprocess, pathlib, sys, json, hashlib
out=pathlib.Path(__file__).resolve().parent
phase=sys.argv[1]
manifest={}
for emitter in ['classic','native']:
 build=pathlib.Path('/tmp/di-bag-task4-'+emitter+'-'+phase)
 manifest[emitter]={str(p.relative_to(build)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(build.glob('*')) if p.is_file()}
 cases=[('observer',m,n) for n in [1000,10000] for m in ['none','fast','pending']]+[('startup',m,96) for m in (['parallel','sequential'] if phase=='before' else ['parallel','sequential','1','8'])]+[('close',m,0) for m in ['fulfilled','pending','failure']]
 for kind,mode,count in cases:
  command=['python',str(out/'record.py'),f'{phase}-{emitter}-{kind}-{mode}-{count}','timeout','30s','node','--expose-gc','--max-old-space-size=512',str(out/'probe.mjs'),str(build/'node.js'),kind,mode,str(count)]
  result=subprocess.run(command)
  if result.returncode: print('Retained failed observation; continuing matrix', flush=True)
(out/(phase+'-build-manifest.json')).write_text(json.dumps(manifest,indent=2)+'\n')
