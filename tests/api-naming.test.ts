// tests/api-naming.test.ts
// The naming ratchet for docs/guides/api-naming.md.
//
// tests/api-naming-known-violations.json lists the violations that existed when the Swift API
// style program started (docs/superpowers/specs/2026-09-20-swift-api-style.md). The list can only
// shrink: a violation that is not listed fails this test, and so does a listed violation that no
// longer occurs. The list must be empty at the end of phase 11 of
// docs/superpowers/plans/2026-09-21-00-swift-api-style-master.md, and it stays empty afterwards.
//
// After fixing names, shrink the list with:
//   UPDATE_API_NAMING_VIOLATIONS=1 bun test tests/api-naming.test.ts
// That mode only removes entries. It never adds one.
import { expect, test } from 'bun:test';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { collectFindings, words } from './api-naming-surface';

const root = resolve(__dirname, '..');
const listPath = resolve(__dirname, 'api-naming-known-violations.json');
const update = process.env.UPDATE_API_NAMING_VIOLATIONS === '1';
const note = 'Known violations of docs/guides/api-naming.md. This list can only shrink and must be empty after phase 11 of the Swift API style program. Shrink it with UPDATE_API_NAMING_VIOLATIONS=1 bun test tests/api-naming.test.ts';

function readKnown(): string[] | undefined {
  if (!existsSync(listPath)) return undefined;
  const parsed: unknown = JSON.parse(readFileSync(listPath, 'utf8'));
  const violations = typeof parsed === 'object' && parsed !== null ? (parsed as { violations?: unknown }).violations : undefined;
  if (!Array.isArray(violations) || violations.some(item => typeof item !== 'string')) throw new Error(`${listPath} must be { "note": string, "violations": string[] }`);
  return violations as string[];
}

test('words splits identifiers, values and codes and ignores the product prefix', () => {
  expect(words('buildAndStart')).toEqual(['build', 'and', 'start']);
  expect(words('DiBagStartupCancelledError')).toEqual(['startup', 'cancelled', 'error']);
  expect(words('DiBag')).toEqual([]);
  expect(words('parentScopeId')).toEqual(['parent', 'scope', 'id']);
  expect(words('scoped:one-per-container')).toEqual(['scoped', 'one', 'per', 'container']);
  expect(words('acquisition-started')).toEqual(['acquisition', 'started']);
  expect(words('INVALID_ACQUISITION_MODE')).toEqual(['invalid', 'acquisition', 'mode']);
  expect(words('HTTPServer')).toEqual(['http', 'server']);
});

test('the scanner reports every rule on the badly named fixture surface', () => {
  expect(collectFindings(resolve(__dirname, 'fixtures/api-naming')).map(finding => finding.id)).toEqual([
    'abbreviation: parameter ctx',
    'abbreviation: parameter deps',
    'boolean-name: member available',
    'boolean-name: member enabled',
    'boolean-name: member enabledNow',
    'builder-method-prefix: contribute',
    'builder-method-prefix: register',
    'retired-word: code DI_BAG_cleanup_DOUBLE',
    'retired-word: code DI_BAG_startup_BAD',
    'retired-word: export StartupThing',
    'retired-word: member scopeId',
    "retired-word: value 'cleanup-finished'",
    "retired-word: value 'cleanup-started'",
    'value-casing: code DI_BAG_cleanup_DOUBLE',
    'value-casing: code DI_BAG_startup_BAD',
    'value-casing: code DI_BAG_template_BAD',
    "value-casing: value 'camelValue'",
    "value-casing: value 'neighboringDiagnosticValue'",
    "value-casing: value 'nestedGenericValue'",
    "value-casing: value 'ordinaryPayloadValue'",
    "value-casing: value 'properPayloadValue'",
    "value-casing: value 'resultValue'",
  ]);
});

test('the public surface has no naming violation outside the known list, and the list only shrinks', () => {
  const current = collectFindings(root);
  const currentIds = new Set(current.map(finding => finding.id));
  let known = readKnown();
  if (update) {
    // The first run records the starting point. Every later run may only remove entries.
    const next = known === undefined ? [...currentIds] : known.filter(id => currentIds.has(id));
    writeFileSync(listPath, `${JSON.stringify({ note, violations: next.sort() }, null, 2)}\n`);
    known = next;
  }
  if (known === undefined) throw new Error(`Missing ${listPath}. Create it once with UPDATE_API_NAMING_VIOLATIONS=1 bun test tests/api-naming.test.ts`);
  const listed = new Set(known);
  const unlisted = current.filter(finding => !listed.has(finding.id)).map(finding => `${finding.id} (first seen at ${finding.where})`);
  const fixed = known.filter(id => !currentIds.has(id));
  const problems = [
    ...(unlisted.length ? [`New naming violations. Fix the names; the known list cannot grow:\n  ${unlisted.join('\n  ')}`] : []),
    ...(fixed.length ? [`Fixed violations are still listed. Run UPDATE_API_NAMING_VIOLATIONS=1 bun test tests/api-naming.test.ts and commit the smaller list:\n  ${fixed.join('\n  ')}`] : []),
  ];
  if (problems.length) throw new Error(problems.join('\n'));
  expect([...known].sort()).toEqual(known);
});
