from pathlib import Path
import fcntl, hashlib, json, subprocess, time
root=Path('/tmp/di-bag-replacement-spike')
out=Path('/tmp/di-bag-replacement-cost-spike')
out.mkdir(exist_ok=True)
types=root/'src/types.ts'; builder=root/'src/di-bag.ts'
original_types=types.read_text(); original_builder=builder.read_text()
rows=[]
direct='''
// THROWAWAY: direct entry distribution changes duplicate-key semantics.
type SpikeLocal<E extends Entry, K extends PropertyKey> = E extends Entry
  ? [Exclude<E['key'], K>] extends [never] ? never : ReplacementRequirement<Required<Needs<E['registration']>>, K>
  : never;
type SpikeRequirements<E extends Entry, K extends PropertyKey, C> = SpikeLocal<E, K> | RetainedReplacementRequirements<C, K>;
export type SpikeOutput<E extends Entry, K extends PropertyKey, C> =
  [SpikeRequirements<E, K, C>] extends [never] ? unknown
    : SpikeRequirements<E, K, C> extends (value: infer O) => void ? O : unknown;
'''
cached='''
// THROWAWAY: distribute across stable registrations before selecting a key.
type SpikeNeeds<R extends Registration> = {
  [K in keyof Required<Needs<R>>]: (value: Required<Needs<R>>[K]) => void;
};
type SpikeLocal<E extends Entry, K extends PropertyKey> = E extends Entry
  ? [Exclude<E['key'], K>] extends [never] ? never : K extends keyof SpikeNeeds<E['registration']> ? SpikeNeeds<E['registration']>[K] : never
  : never;
type SpikeRequirements<E extends Entry, K extends PropertyKey, C> = SpikeLocal<E, K> | RetainedReplacementRequirements<C, K>;
export type SpikeOutput<E extends Entry, K extends PropertyKey, C> =
  [SpikeRequirements<E, K, C>] extends [never] ? unknown
    : SpikeRequirements<E, K, C> extends (value: infer O) => void ? O : unknown;
'''
filter_map="""
type NamedConsumers<R extends Registrations> = { [P in keyof R as [keyof Needs<R[P]>] extends [never] ? never : P]: R[P] };
type LocalReplacementRequirements<R extends Registrations, K extends PropertyKey> = FilteredLocal<NamedConsumers<R>, K>;
"""
filter_entries="""
// UNSAFE with manually annotated overlapping erased-provider entries.
type NamedConsumerEntries<E extends Entry> = E extends Entry ? [keyof Needs<E['registration']>] extends [never] ? never : E : never;
"""
variants=[('consumer-map-filter-PROTOTYPE',original_types.replace('type LocalReplacementRequirements<',filter_map+'type FilteredLocal<'),original_builder),
('consumer-entry-filter-UNSAFE', original_types+filter_entries.replace('type NamedConsumerEntries','export type NamedConsumerEntries'), original_builder.replace('  ReplacementOutput,','  ReplacementOutput,\n  NamedConsumerEntries,').replace('ReplacementOutput<From<E>, K, C>', 'ReplacementOutput<From<NamedConsumerEntries<E>>, K, C>'))]
with open('/tmp/di-bag-compiler-heavy.lock','a') as lock:
 fcntl.flock(lock,fcntl.LOCK_EX)
 try:
  for name,ts,bs in variants:
   types.write_text(ts);builder.write_text(bs)
   variant=out/name;variant.mkdir(exist_ok=True)
   (variant/'types.ts').write_text(ts);(variant/'di-bag.ts').write_text(bs)
   argv=['node','--max-old-space-size=3072','--disable-warning=MODULE_TYPELESS_PACKAGE_JSON','scripts/benchmark-types.ts','--worker','100','replacement','valid']
   start=time.monotonic();child=subprocess.run(argv,cwd=root,text=True,capture_output=True,timeout=65)
   (variant/'stdout.log').write_text(child.stdout);(variant/'stderr.log').write_text(child.stderr)
   row={'variant':name,'status':child.returncode,'seconds':time.monotonic()-start,'argv':argv,'result':json.loads(child.stdout) if child.stdout.startswith('{') else None}
   rows.append(row);print(json.dumps(row),flush=True)
 finally:
  types.write_text(original_types);builder.write_text(original_builder)
  (out/'consumer-filter-rows.json').write_text(json.dumps(rows,indent=2)+'\n')
