// Lists every DI_BAG_ code literal in src with its owning call and message. Exits 1 unless every literal is accounted for
// and every DI_BAG_INVALID_ARGUMENT site names operation, argument and expected in its details.
import { readdirSync, readFileSync, writeSync } from 'node:fs';
import { join } from 'node:path';

const root = process.argv[2] ?? 'src';
const literal = /'(DI_BAG_[A-Z_]+)'/g;
const starter = /\b(libraryError|libraryTypeError|diagnosticMessage|diagnostic|snapshotOptions|classifierRequired)\(/;
const argument = /^\s*,\s*(`(?:[^`\\]|\\.)*`|'(?:[^'\\]|\\.)*')/;
const rows = [];
let found = 0, accounted = 0;

for (const file of readdirSync(root).filter(name => name.endsWith('.ts')).sort()) {
  const lines = readFileSync(join(root, file), 'utf8').split('\n');
  lines.forEach((line, index) => {
    const matches = [...line.matchAll(literal)];
    if (!matches.length) return;
    found += matches.length;
    const text = line.trim();
    const nonThrow = text.startsWith('*') || text.startsWith('//') || text.startsWith('/**')
      || text.includes('declare readonly code') || /^export type DiBagErrorCode/.test(text);
    if (nonThrow) { accounted += matches.length; return; }
    let owner;
    for (let back = 0; back < 3 && index - back >= 0 && !owner; back++) owner = starter.exec(lines[index - back])?.[1];
    owner ??= /const code\s*=/.test(line) ? 'code variable' : 'UNCLASSIFIED';
    // Anchor on the LAST literal of THIS line, then read the string argument that follows it, across line breaks.
    const last = matches[matches.length - 1];
    const tail = line.slice(last.index + last[0].length) + ' ' + lines.slice(index + 1, index + 3).map(next => next.trim()).join(' ');
    const quoted = argument.exec(tail)?.[1];
    const message = quoted?.slice(1, -1) ?? '';
    accounted += matches.length;
    const row = { file: `${root}/${file}`, line: index + 1, owner, codes: matches.map(match => match[1]), message };
    if (row.codes.includes('DI_BAG_INVALID_ARGUMENT') && /^library(Type)?Error$/.test(owner)) {
      // The details are whatever follows the message up to the end of the statement; a word inside the message does not count.
      const rest = (line.slice(last.index + last[0].length) + ' ' + lines.slice(index + 1, index + 6).map(next => next.trim()).join(' ')).replace(quoted ?? '', '');
      const details = rest.slice(0, rest.indexOf(');') === -1 ? rest.length : rest.indexOf(');'));
      row.missingDetails = ['operation', 'argument', 'expected'].filter(key => !new RegExp(`\\b${key}\\b`).test(details));
    }
    rows.push(row);
  });
}

const unclassified = rows.filter(row => row.owner === 'UNCLASSIFIED');
const incomplete = rows.filter(row => row.missingDetails?.length);
if (process.argv.includes('--json')) writeSync(1, `${JSON.stringify(rows, null, 2)}\n`);
else for (const row of rows) writeSync(1, `${[row.file, row.line, row.owner, row.codes.join('|'), row.message].join('\t')}\n`);
writeSync(2, `literals: ${found}; accounted: ${accounted}; rows: ${rows.length}; codes: ${new Set(rows.flatMap(row => row.codes)).size}; unclassified: ${unclassified.length}; incomplete details: ${incomplete.length}\n`);
process.exitCode = found === accounted && unclassified.length === 0 && incomplete.length === 0 ? 0 : 1;
