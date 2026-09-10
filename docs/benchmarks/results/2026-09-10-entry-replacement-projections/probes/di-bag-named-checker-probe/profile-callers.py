import sys,runpy,collections,json
from pathlib import Path
profile_path=next(Path('/tmp/di-bag-named-checker-probe/native500/profiles').glob('*cpuprofile.pb.gz'))
sys.argv=['read-profile.py',str(profile_path)]
from contextlib import redirect_stdout
import io
with redirect_stdout(io.StringIO()):d=runpy.run_path('/tmp/di-bag-named-checker-probe/read-profile.py')
paths=collections.Counter()
for data in d['profile'][2]:
 f=d['fields'](data);value=d['numbers'](f[2])[d['idx']];stack=[d['functions'][function]['name'] for loc in d['numbers'](f[1]) for function in d['locations'][loc]]
 if stack and stack[0].endswith('ast.GetSourceFileOfNode'):paths[tuple(stack[:12])]+=value
print(json.dumps([{'nanoseconds':v,'stack':k} for k,v in paths.most_common(10)],indent=2))
