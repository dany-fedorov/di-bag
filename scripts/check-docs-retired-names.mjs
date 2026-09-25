// Finds removed API names and retired vocabulary in human-facing documentation.
// Usage: node scripts/check-docs-retired-names.mjs [--map file] [--root dir] [file.md ...]
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2);
const take = name => { const index = args.indexOf(name); return index === -1 ? undefined : args.splice(index, 2)[1]; };
const root = resolve(take('--root') ?? '.');
const map = JSON.parse(readFileSync(take('--map') ?? join(root, 'tools/codemod/rename-map.json'), 'utf8'));
const markdownIn = directory => existsSync(join(root, directory))
  ? readdirSync(join(root, directory)).filter(file => file.endsWith('.md')).sort().map(file => `${directory}/${file}`) : [];
const skipped = new Set(['docs/guides/migrating-to-0.5.md']);
const files = (args.length ? args : ['README.md', 'docs/README.md', 'PUBLISHING.md', 'tools/graph/README.md',
  ...markdownIn('docs/guides'), ...markdownIn('docs/benchmarks')])
  .filter(file => existsSync(join(root, file)) && !skipped.has(file));

const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const live = new Set((map.methods ?? []).map(entry => entry.to));
const calls = [...new Set((map.methods ?? []).filter(entry => entry.from !== entry.to && !live.has(entry.from)).map(entry => entry.from))];
const names = [...(map.types ?? []).filter(entry => entry.from !== entry.to).map(entry => entry.from), ...(map.codes ?? []).map(entry => entry.from)];
const quoted = [...new Set((map.values ?? []).map(entry => entry.from))];
const imports = (map.imports ?? []).filter(entry => entry.from).map(entry => entry.from);
const rules = [
  ...calls.map(name => ({ kind: 'call', name, pattern: new RegExp('(?<![A-Za-z0-9_$])' + escape(name) + '\\(|`' + escape(name) + '`') })),
  ...names.map(name => ({ kind: 'name', name, pattern: new RegExp('(?<![A-Za-z0-9_])' + escape(name) + '(?![A-Za-z0-9_])') })),
  ...quoted.map(name => ({ kind: 'value', name, pattern: new RegExp("'" + escape(name) + "'") })),
  ...imports.map(name => ({ kind: 'import', name, pattern: new RegExp("'" + escape(name) + "'") })),
  ...[['cleanup', /\bcleanups?\b/i], ['startup', /\bstartup\b/i], ['acquisition mode', /\bacquisition ?modes?\b/i],
    ['bag', /\bbags?\b/i], ['scope', /\b(child )?scopes?\b/i], ['fork', /\bfork(s|ed|ing)?\b/i],
    ['root lifetime', /\broot (lifetime|service|provider)s?\b/i], ['family', /\b(ownership )?famil(y|ies)\b/i]]
    .map(([name, pattern]) => ({ kind: 'word', name, pattern })),
];

const product = [/DI Bag/g, /(?<![A-Za-z0-9_])DiBag(?![A-Za-z0-9_])/g];
const allowed = [...product, /DiBag[A-Za-z]*/g, /di-bag[a-z-]*/g, /DI_BAG_[A-Z_]+/g,
  /\boptions? bags?\b/gi, /\bbags? of options\b/gi, /\b(one|single|the) bag\b(?= of| with| whose| that holds)/gi,
  /\b(in|out of|within) scope\b/gi, /\bfork (the|this|a) repo(sitory)?\b/gi];

function isHistoricalEvidence(file, section, line) {
  if (file !== 'docs/guides/api-naming.md') return false;
  if (section === 'Vocabulary' && /^\|/.test(line)) return true;
  if (section === 'Measured exceptions' && /^\|/.test(line)) return true;
  return section === 'What the naming test checks' && /^\|/.test(line);
}

function isNamingExplanation(file, section, line, rule) {
  if (file !== 'docs/guides/api-naming.md') return false;
  if (section === 'The rules' && rule.kind === 'word' && rule.name === 'bag') return true;
  if (section === 'The rules' && rule.kind === 'call' && rule.name === 'verifyGraph' && /never `verifyGraph`/.test(line)) return true;
  if (section === 'The rules' && rule.kind === 'call' && rule.name === 'token' && /`provider`, `token`/.test(line)) return true;
  return rule.kind === 'value' && rule.name === 'scoped' && /`'scoped'` alone is rejected/.test(line);
}

let findings = 0;
for (const file of files) {
  let fence;
  let section = '';
  readFileSync(join(root, file), 'utf8').split('\n').forEach((line, index) => {
    const heading = line.match(/^## (.+)$/);
    if (!fence && heading) section = heading[1];
    const marker = line.match(/^\s*(`{3,}|~{3,})/);
    if (marker) {
      if (!fence) fence = marker[1];
      else if (marker[1][0] === fence[0] && marker[1].length >= fence.length) fence = undefined;
    }
    let prose = fence || marker ? '' : line.replace(/`[^`]*`/g, match => ' '.repeat(match.length));
    for (const pattern of allowed) prose = prose.replace(pattern, match => ' '.repeat(match.length));
    const historical = isHistoricalEvidence(file, section, line);
    if (historical) prose = '';
    let named = line;
    for (const pattern of product) named = named.replace(pattern, match => ' '.repeat(match.length));
    if (historical) named = '';
    for (const rule of rules) {
      if (isNamingExplanation(file, section, line, rule)) continue;
      if (!rule.pattern.test(rule.kind === 'word' ? prose : named)) continue;
      findings += 1;
      console.log(`${file}:${index + 1}: retired ${rule.kind} ${rule.name}`);
    }
  });
}
console.error(`${findings} finding(s) in ${files.length} file(s)`);
process.exit(findings ? 1 : 0);
