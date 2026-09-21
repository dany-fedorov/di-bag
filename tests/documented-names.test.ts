import { expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

// The naming standard (docs/guides/api-naming.md, rule 7) bans abbreviations in names a reader
// sees: signatures, JSDoc and the agent docs. Test files and examples name their own parameters.
const root = resolve(__dirname, '..');
const abbreviation = /\b(factoryCtx|disposerCtx|deps|_deps)\b/;

// The dependency proxy's `in` trap quotes the caller's expression in a runtime message and in
// `details.access`. Message text is behavior; the error phase of the 0.5.0 program rewrites it.
const allowed = new Set(["src/acquisition.ts: has: (_, key) => { throw invalidAccess(`'${String(key)}' in deps`); },"]);

function offenders(files: readonly string[]): string[] {
  return files.flatMap(file => readFileSync(join(root, file), 'utf8').split('\n').flatMap((line, index) =>
    abbreviation.test(line) && !allowed.has(`${file}: ${line.trim()}`) ? [`${file}:${index + 1}: ${line.trim()}`] : []));
}

test('library source spells out factoryContext, disposerContext and dependencies', () => {
  const files = readdirSync(join(root, 'src')).filter(name => name.endsWith('.ts')).sort().map(name => `src/${name}`);
  expect(offenders(files)).toEqual([]);
});

test('agent docs spell out factoryContext, disposerContext and dependencies', () => {
  const agentDocs = readdirSync(join(root, 'docs/agent')).filter(name => name.endsWith('.md')).sort().map(name => `docs/agent/${name}`);
  expect(offenders(['AGENTS.md', ...agentDocs])).toEqual([]);
});
