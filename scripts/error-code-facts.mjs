// Read-only facts for renaming one runtime code. Usage, from the repository root: node scripts/error-code-facts.mjs OLD_CODE NEW_CODE
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const [OLD, NEW] = process.argv.slice(2);
if (process.argv.length !== 4 || !/^DI_BAG_[A-Z_]+$/.test(OLD ?? '') || !/^DI_BAG_[A-Z_]+$/.test(NEW ?? '')) {
  console.error('usage: node scripts/error-code-facts.mjs OLD_CODE NEW_CODE');
  process.exit(2);
}
const Q = "'", BT = '`';
const fragment = code => '#' + code.toLowerCase().replaceAll('_', '-');
const word = code => new RegExp('(?<![A-Z_])' + code + '(?![A-Z_])', 'g');
const read = file => readFileSync(file, 'utf8');
function walk(directory, extensions) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory).sort().flatMap(name => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? walk(path, extensions) : extensions.some(extension => name.endsWith(extension)) ? [path] : [];
  });
}
const sources = readdirSync('src').filter(name => name.endsWith('.ts')).sort().map(name => join('src', name));

console.log(`${OLD} -> ${NEW}   anchor ${fragment(OLD)} -> ${fragment(NEW)}`);

const sites = [], ticks = [];
for (const file of sources) {
  read(file).split('\n').forEach((line, index) => {
    if (line.includes(Q + OLD + Q)) sites.push(`${file}:${index + 1}[${/(libraryError|libraryTypeError|diagnostic|diagnosticMessage|snapshotOptions)\(/.test(line) ? 'throw' : 'other'}]`);
    if (line.includes(BT + OLD + BT)) ticks.push(file);
  });
}
console.log(`src single-quoted: ${sites.length}  ${sites.join(', ')}`);
console.log(`src backticked (JSDoc): ${ticks.length}  ${[...new Set(ticks)].sort().map(file => `${file} x${ticks.filter(item => item === file).length}`).join(', ')}`);

const EQ = 'string equal to the code (codemod rewrites)', REP = 'other TypeScript occurrence (codemod reports, edit by hand)', JS = 'JavaScript without types (not reported, edit by hand)';
const forms = new Map([[EQ, new Set()], [REP, new Set()], [JS, new Set()]]), counts = new Map([[EQ, 0], [REP, 0], [JS, 0]]);
for (const file of walk('tests', ['.ts', '.tsx', '.mjs'])) {
  for (const line of read(file).split('\n')) {
    for (const match of line.matchAll(word(OLD))) {
      const before = line[match.index - 1] ?? '', after = line[match.index + OLD.length] ?? '';
      const kind = file.endsWith('.mjs') ? JS : [Q, '"', BT].includes(before) && after === before ? EQ : REP;
      counts.set(kind, counts.get(kind) + 1); forms.get(kind).add(file);
    }
  }
}
console.log(`tests: ${[...counts.values()].reduce((sum, value) => sum + value, 0)} occurrences`);
for (const [kind, count] of counts) if (count) console.log(`   ${count}  ${kind}: ${[...forms.get(kind)].sort().join(', ')}`);

const markdown = [...['AGENTS.md', 'README.md'].filter(existsSync), ...walk('docs/agent', ['.md']), ...walk('docs/guides', ['.md']), ...['tools/graph/README.md'].filter(existsSync)].sort();
const anchor = fragment(OLD).slice(1);
const escaped = anchor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const anchorBoundary = new RegExp(escaped + '([^a-z0-9-]|$)', 'g');
for (const file of markdown) {
  const text = read(file), codes = [...text.matchAll(word(OLD))].length, anchors = [...text.matchAll(anchorBoundary)].length;
  if (!codes && !anchors) continue;
  const links = [...text.matchAll(new RegExp('\\]\\([^)]*' + escaped + '([^a-z0-9-]|$)', 'g'))].length;
  console.log(`   ${file}${file.endsWith('api-card.md') ? ' (generated)' : ''}: code x${codes}, anchor x${anchors} of which real links x${links}`);
}
const all = [...new Set(sources.flatMap(file => read(file).match(/DI_BAG_[A-Z_]+/g) ?? []))].sort();
const longer = all.filter(code => code.startsWith(OLD) && code !== OLD);
console.log(`longer codes sharing the old prefix: ${longer.length ? JSON.stringify(longer) : 'none'}`);
const used = [...sources, ...walk('tests', ['.ts']), ...walk('docs/agent', ['.md'])].some(file => word(NEW).test(read(file)));
console.log(`new name already used in src/tests/docs: ${used ? 'True' : 'False'}`);
console.log(`new code starts with the old code: ${NEW.startsWith(OLD) ? 'True' : 'False'}`);
const places = 'src tests examples scripts AGENTS.md README.md docs/agent docs/guides tools/docs/lib tools/docs/test tools/docs/*.json tools/graph/lib tools/graph/test tools/graph/README.md';
console.log('gate, run after `npm run build && npm run docs:generate`; both commands must print nothing:');
console.log(`  grep -rnE '${OLD}([^A-Z_]|$)' ${places}`);
console.log(`  grep -rnE '${fragment(OLD).slice(1)}([^a-z0-9-]|$)' ${places}`);
