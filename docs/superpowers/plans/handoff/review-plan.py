# Mechanical review of a plan file before it is committed. Usage: python3 review-plan.py <plan.md>
import re,sys
p=sys.argv[1]; s=open(p).read(); lines=s.split('\n')
print(f"{p.split('/')[-1]}: {len(lines)} lines, {len(re.findall(r'^### Task', s, re.M))} tasks, {len(re.findall(r'^- \[ \] ', s, re.M))} steps")
depth=[]; bad=0
for i,line in enumerate(lines,1):
    m=re.match(r'^\s*(`{3,})([\w-]*)\s*$', line)
    if not m: continue
    ticks,lang=m.groups()
    if depth and depth[-1][0]==len(ticks) and not lang: depth.pop()
    elif lang or not depth or len(ticks)<depth[-1][0]: depth.append((len(ticks),i))
    else: bad+=1
print('  fences: unclosed', [d[1] for d in depth], 'odd closes', bad)
def scan(label, pattern, flags=re.I):
    hits=[(i,l.strip()[:150]) for i,l in enumerate(lines,1) if re.search(pattern,l,flags)]
    print(f"  {label}: {len(hits)}")
    for i,l in hits[:8]: print(f"     {i}: {l}")
scan('placeholders', r'\bTBD\b|\bTODO\b|implement later|fill in|similar to task|add appropriate|handle edge cases|write tests for the above')
scan('em dashes or arrows', '—|→', 0)
scan('claims of compiling (each must be true or caveated)', r'\b(was|were|is|are) (type-?checked|compiled)\b|\bcompiles\b|\btype-checks\b|tsc6? .*(passed|exit 0)|prototype[sd]? (compiled|type-checked)')
scan('git add -A or add .', r'git add (-A|\.|--all)\b', 0)
scan('secrets', r'npm_[A-Za-z0-9]{20,}|_authToken', 0)
scan('heavy commands the PLANNER claims to have run', r'\b(I|we) ran (npm run (check|test|typecheck|build)|tsc)', re.I)
header=all(k in s for k in ['**Goal:**','**Architecture:**','**Tech Stack:**','**Spec:**','## Global Constraints','## State on entry','## File Structure'])
print('  header complete:', header, ' self-review:', 'Self-review' in s or 'Self-Review' in s, ' uncompiled caveat present:', bool(re.search(r'uncompiled|not compiled|NOT compiled|was not run|were not run|NOT run', s)))
