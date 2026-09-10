# Diagnostic-only pprof reader. Wire field definitions:
# https://github.com/google/pprof/blob/main/proto/profile.proto
import gzip,sys,json,collections
from pathlib import Path
def varint(data,pos):
 value=0;shift=0
 while True:
  byte=data[pos];pos+=1;value|=(byte&127)<<shift
  if byte<128:return value,pos
  shift+=7
  assert shift<70

def fields(data):
 result=collections.defaultdict(list);pos=0
 while pos<len(data):
  tag,pos=varint(data,pos);field,wire=tag>>3,tag&7
  if wire==0:value,pos=varint(data,pos)
  elif wire==2:
   size,pos=varint(data,pos);value=data[pos:pos+size];pos+=size
  elif wire in (1,5):
   size=8 if wire==1 else 4;value=data[pos:pos+size];pos+=size
  else:raise ValueError('unsupported wire '+str(wire))
  result[field].append(value)
 return result

def numbers(items):
 result=[]
 for item in items:
  if isinstance(item,int):result.append(item)
  else:
   pos=0
   while pos<len(item):value,pos=varint(item,pos);result.append(value)
 return result
profile=fields(gzip.decompress(Path(sys.argv[1]).read_bytes()));strings=[s.decode() for s in profile[6]]
functions={}
for data in profile[5]:
 f=fields(data);functions[f[1][0]]={'name':strings[f[2][0]],'file':strings[f[4][0]] if f[4] else ''}
locations={}
for data in profile[4]:
 f=fields(data);locations[f[1][0]]=[fields(line)[1][0] for line in f[4]]
kinds=[]
for data in profile[1]:
 f=fields(data);kinds.append({'name':strings[f[1][0]],'unit':strings[f[2][0]]})
idx=int(sys.argv[2]) if len(sys.argv)>2 else len(kinds)-1
flat=collections.Counter();cumulative=collections.Counter();total=0
for data in profile[2]:
 f=fields(data);values=numbers(f[2]);assert len(values)==len(kinds)
 value=values[idx];total+=value;stack=[function for loc in numbers(f[1]) for function in locations[loc]]
 if stack:
  flat[stack[0]]+=value
  for function in set(stack):cumulative[function]+=value
assert sum(flat.values())==total
rank=lambda c:[dict(functions[f],value=v,percent=100*v/total) for f,v in c.most_common(35)]
print(json.dumps({'input':sys.argv[1],'kind':kinds[idx],'kinds':kinds,'samples':len(profile[2]),'total':total,'sourceFileLookup':{'value':sum(v for f,v in flat.items() if functions[f]['name'].endswith('ast.GetSourceFileOfNode')),'percent':100*sum(v for f,v in flat.items() if functions[f]['name'].endswith('ast.GetSourceFileOfNode'))/total},'flat':rank(flat),'cumulative':rank(cumulative)},indent=2))
