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

test('escaped replacements parse to their exact key and value strings', () => {
  const ts = compiler.ts;
  const source = ts.createSourceFile('escaped.ts', runFixture('literal-escaping').text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  assert.deepEqual(source.parseDiagnostics, []);
  let literal;
  const visit = node => {
    if (ts.isObjectLiteralExpression(node) && node.properties.length === 3) literal = node;
    ts.forEachChild(node, visit);
  };
  visit(source);
  assert.ok(literal);
  assert.deepEqual(literal.properties.map(property => property.name.text), ["key'\\\n", 'key"\\\t', "identifier'\\\r"]);
  assert.deepEqual(literal.properties.map(property => property.initializer.text), ["single'\\\n\t\x01", 'double"\\\r\b\f', 'template`\\${value}\u2028\u2029']);
});
