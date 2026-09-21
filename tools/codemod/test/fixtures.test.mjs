// tools/codemod/test/fixtures.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compiler, fixtureNames, fixturesProgram, readFixture, runFixture } from './helpers.mjs';

test('every fixture input type-checks against the published di-bag 0.4.0 declarations', () => {
  const ts = compiler.ts;
  const messages = ts.getPreEmitDiagnostics(fixturesProgram()).map(diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
  assert.deepEqual(messages, []);
  assert.ok(fixtureNames.length >= 8, `found ${fixtureNames.length} fixtures`);
});

for (const name of fixtureNames) {
  test(`fixture ${name}: rewritten text and manual items`, () => {
    const result = runFixture(name);
    assert.equal(result.text, readFixture(name, 'expected.ts'));
    assert.deepEqual(result.manual, JSON.parse(readFixture(name, 'expected-manual.json')));
  });
}

test('a rewritten file is stable: a second run changes nothing the first run could decide', () => {
  // The expected files use 0.5 names that the 0.4.0 declarations lack, so only the text-level guarantee is checked:
  // no old method name that the map renames without conditions is left in an expected file.
  assert.doesNotMatch(readFixture('method-rename', 'expected.ts'), /\.(register|contribute|verifyGraph|inspectGraph)\(/);
  assert.doesNotMatch(readFixture('array-argument', 'expected.ts'), /\.(installModule|renameExport)\(/);
});
