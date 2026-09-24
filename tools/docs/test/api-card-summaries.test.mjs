import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

// The naming standard (docs/guides/api-naming.md, rule 13): a call whose summary needs "or"
// between two purposes should be two calls. Each current summary starts with a reviewed imperative verb.
// This reads the generated card, so run `npm run docs:generate` after editing a JSDoc summary.
const directory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const card = readFileSync(resolve(directory, '../../docs/agent/api-card.md'), 'utf8');
const exceptions = JSON.parse(readFileSync(resolve(directory, 'api-card-summary-exceptions.json'), 'utf8'));

/** The summary of every call in the card, keyed by its heading id. Error classes are nouns and are skipped. */
function callSummaries(markdown) {
  const lines = markdown.split('\n');
  const summaries = [];
  let section = '';
  lines.forEach((line, index) => {
    const sectionHeading = /^## .*\{#([a-z0-9-]+)\}$/.exec(line);
    if (sectionHeading) { section = sectionHeading[1]; return; }
    const heading = /^### .*\{#([a-z0-9-]+)\}$/.exec(line);
    if (!heading || section === 'errors' || section === 'one-way-per-task') return;
    summaries.push({ id: heading[1], text: (lines[index + 1] ?? '').replace(/ Throws: .*$/, '') });
  });
  return summaries;
}

const summaries = callSummaries(card);
const acceptedLeadingVerbs = new Set([
  'Adapt', 'Add', 'Append', 'Attach', 'Begin', 'Close', 'Create', 'Describe', 'Finish', 'Inspect',
  'Install', 'Make', 'Replace', 'Report', 'Resolve', 'Return', 'Seal', 'Select', 'Transform', 'Validate',
]);
const leadingWord = text => /^([A-Z][a-z]+)\b/.exec(text)?.[1];
const joinsPurposes = text => /\bor\b/.test(text.replace(/\bsingleton, scoped, or transient\b/g, 'lifetime choices'));

test('the card has call summaries to check', () => {
  assert(summaries.length >= 20, `found ${summaries.length} call summaries`);
  for (const { id, text } of summaries) assert(text.length > 0, `${id} has no summary line`);
});

test('no call summary needs "or", apart from the recorded exceptions', () => {
  const offenders = summaries.filter(({ text }) => joinsPurposes(text)).map(({ id }) => id).sort();
  assert.deepEqual(offenders, [...exceptions.or].sort(),
    'A new id means a summary joins two purposes with "or": split the call or reword the summary. '
    + 'A missing id means an exception is stale: delete it from tools/docs/api-card-summary-exceptions.json.');
});

test('a lifetime enumeration does not hide a second purpose', () => {
  assert.equal(joinsPurposes('Return a provider with singleton, scoped, or transient caching.'), false);
  assert.equal(joinsPurposes('Return a provider or resolve a service.'), true);
  assert.equal(joinsPurposes('Return a provider with singleton, scoped, or transient caching or resolve a service.'), true);
});

test('the accepted leading-word set rejects a noun-phrase control', () => {
  assert.equal(acceptedLeadingVerbs.has(leadingWord('Services remain cached.')), false);
});

test('every call summary starts with a reviewed imperative verb', () => {
  const offenders = summaries.filter(({ text }) => !acceptedLeadingVerbs.has(leadingWord(text))).map(({ id }) => id).sort();
  assert.deepEqual(offenders, [],
    'A summary must start with a reviewed imperative verb. Add a genuinely new verb to acceptedLeadingVerbs only with its intentional summary.');
});

test('lifetime summary states the scoped default and the facade option bag', () => {
  assert.match(card, /### `DiBag\.providerWithLifetime\(options\)`/);
  assert.equal(summaries.find(({ id }) => id === 'dibag-providerwithlifetime')?.text,
    'Return a provider with singleton, scoped, or transient caching. Providers are scoped per container by default; mark shared clients singleton when none of their dependencies are scoped.');
  assert.match(card, /const client = DiBag\.providerWithLifetime\(\{ provider: DiBag\.createProvider\(\(\) => createClient\(\)\), lifetime: 'singleton:one-per-container-tree' \}\);/);
});
