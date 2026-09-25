// Finds removed API names and retired vocabulary in human-facing documentation.
// Usage: node scripts/check-docs-retired-names.mjs [--map file] [--root dir] [file.md ...]
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

const args = process.argv.slice(2);
const take = name => { const index = args.indexOf(name); return index === -1 ? undefined : args.splice(index, 2)[1]; };
const root = resolve(take('--root') ?? '.');
const map = JSON.parse(readFileSync(take('--map') ?? join(root, 'tools/codemod/rename-map.json'), 'utf8'));
const markdownIn = directory => existsSync(join(root, directory))
  ? readdirSync(join(root, directory)).filter(file => file.endsWith('.md')).sort().map(file => `${directory}/${file}`) : [];
const skipped = new Set(['docs/guides/migrating-to-0.5.md']);
const canonical = file => relative(root, resolve(root, file)).split(sep).join('/');
const files = (args.length ? args : ['README.md', 'docs/README.md', 'PUBLISHING.md', 'tools/graph/README.md',
  ...markdownIn('docs/guides'), ...markdownIn('docs/benchmarks')])
  .map(canonical)
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

const blank = text => ' '.repeat(text.length);
const maskCell = (line, index) => {
  const cells = line.split('|');
  if (cells.length <= index + 1) return line;
  cells[index] = blank(cells[index]);
  return cells.join('|');
};

function maskHistoricalEvidence(file, section, original, text) {
  if (file !== 'docs/guides/api-naming.md' || !original.startsWith('|')) return text;
  if (section === 'Vocabulary') return maskCell(text, 3); // Only the retired-words column is historical.
  if (section === 'What the naming test checks' && /^\| `(?:builder-method-prefix|retired-word)` \|/.test(original)) {
    return maskCell(text, 3); // These two rule descriptions intentionally spell retired names.
  }
  if (section === 'Measured exceptions' && /^\| (?:Collection-token branches|`withTokenService\(|`withReplacedService\(|Replacement fields inside|`inspect`)/.test(original)) {
    // The rejected design and its measurement are historical; the selected fallback remains checked.
    let masked = maskCell(maskCell(text, 1), 3);
    if (original.startsWith('| Replacement fields inside')) masked = masked.replace(/\boptional bag\b/, blank('optional bag'));
    return masked;
  }
  return text;
}

function maskNamingExplanation(file, section, text) {
  if (file !== 'docs/guides/api-naming.md') return text;
  if (section === 'The rules') {
    for (const phrase of [/\ba bag in which every property is optional\b/i, /\bone bag with named properties\b/i,
      /\ba bag with named properties\b/i, /\ba bag that only\b/i, /\bAn optional bag can\b/i,
      /\ba bag by nature\b/i, /\bthe bag under its role name\b/i]) {
      text = text.replace(phrase, blank);
    }
    text = text.replace(/`verifyGraph`(?=, because the call does nothing)/, blank);
    text = text.replace(/(?<=`provider`, )`token`(?=\. "Don't surprise)/, blank);
  }
  if (section === 'Term and description values') text = text.replace(/`'scoped'`(?= alone is rejected)/, blank);
  return text;
}

function fenceMarker(line) {
  let rest = line;
  let quoteDepth = 0;
  while (true) {
    const quote = rest.match(/^ {0,3}>[ \t]?/);
    if (!quote) break;
    quoteDepth += 1;
    rest = rest.slice(quote[0].length);
  }
  const marker = rest.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
  return marker ? { quoteDepth, delimiter: marker[1], tail: marker[2] } : undefined;
}

let findings = 0;
for (const file of files) {
  let fence;
  let section = '';
  readFileSync(join(root, file), 'utf8').split('\n').forEach((line, index) => {
    const heading = line.match(/^## (.+)$/);
    if (!fence && heading) section = heading[1];
    const marker = fenceMarker(line);
    let boundary = false;
    if (marker) {
      if (!fence && (marker.delimiter[0] === '~' || !marker.tail.includes('`'))) {
        fence = marker;
        boundary = true;
      } else if (fence && marker.quoteDepth === fence.quoteDepth && marker.delimiter[0] === fence.delimiter[0]
        && marker.delimiter.length >= fence.delimiter.length && /^[ \t]*$/.test(marker.tail)) {
        fence = undefined;
        boundary = true;
      }
    }
    let prose = fence || boundary ? '' : line.replace(/`[^`]*`/g, match => ' '.repeat(match.length));
    for (const pattern of allowed) prose = prose.replace(pattern, match => ' '.repeat(match.length));
    let named = line;
    for (const pattern of product) named = named.replace(pattern, match => ' '.repeat(match.length));
    prose = maskNamingExplanation(file, section, maskHistoricalEvidence(file, section, line, prose));
    named = maskNamingExplanation(file, section, maskHistoricalEvidence(file, section, line, named));
    for (const rule of rules) {
      if (!rule.pattern.test(rule.kind === 'word' ? prose : named)) continue;
      findings += 1;
      console.log(`${file}:${index + 1}: retired ${rule.kind} ${rule.name}`);
    }
  });
}
console.error(`${findings} finding(s) in ${files.length} file(s)`);
process.exit(findings ? 1 : 0);
