// tests/api-naming.test.ts
// Tests for the public-surface scanner in tests/api-naming-surface.ts. The naming ratchet
// for docs/guides/api-naming.md is added to this file in the next task.
import { expect, test } from 'bun:test';
import { resolve } from 'node:path';
import { collectFindings, words } from './api-naming-surface';

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
    'boolean-name: member enabled',
    'builder-method-prefix: contribute',
    'builder-method-prefix: register',
    'retired-word: code DI_BAG_startup_BAD',
    'retired-word: export StartupThing',
    'retired-word: member scopeId',
    "retired-word: value 'cleanup-started'",
    'value-casing: code DI_BAG_startup_BAD',
    "value-casing: value 'camelValue'",
  ]);
});
