import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

type RenameMap = { methods?: { owner: string; from: string }[]; types?: { from: string }[] };
const asWord = (name: string) => new RegExp(`(?<![A-Za-z0-9_$])${name.replace(/[$]/g, '\\$&')}(?![A-Za-z0-9_$])`);

/** The removed callable names and exported types that the negative fixture never mentions as a whole word. */
export function uncovered(map: RenameMap, fixture: string): string[] {
  const removed = [...(map.methods ?? []).map(entry => ({ label: `${entry.owner}.${entry.from}`, name: entry.from })), ...(map.types ?? []).map(entry => ({ label: entry.from, name: entry.from }))];
  return [...new Set(removed.filter(item => !asWord(item.name).test(fixture)).map(item => item.label))].sort();
}

test('a name counts only as a whole word', () => {
  const map = { methods: [{ owner: 'Builder', from: 'build' }, { owner: 'Builder', from: 'buildAndStart' }, { owner: 'Bag', from: 'fork' }], types: [{ from: 'Bag' }, { from: 'StartupOptions' }] };
  const fixture = "builder.buildAndStart(['a']);\ntype Removed = import('../../../src').StartupOptions;\nconst bags = 1; // DiBag\n";
  expect(uncovered(map, fixture)).toEqual(['Bag', 'Bag.fork', 'Builder.build']);
});

const mapFile = resolve(__dirname, '../tools/codemod/rename-map.json');
const fixtureFile = resolve(__dirname, 'types/negative/api-renaming.ts');
test('every removed method and type of the rename map has a line in the negative fixture', () => {
  expect(uncovered(JSON.parse(readFileSync(mapFile, 'utf8')), readFileSync(fixtureFile, 'utf8'))).toEqual([]);
});
