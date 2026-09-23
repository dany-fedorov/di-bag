// tools/codemod/test/fixtures.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compiler, fixtureNames, fixturesProgram, fixturesRoot, readFixture, runFixture } from './helpers.mjs';

test('ordinary fixture inputs type-check and the negative provider-method edge input has exactly its declared diagnostics', () => {
  const ts = compiler.ts;
  const edgeFile = ts.sys.resolvePath(`${fixturesRoot}/provider-method-edges/input.ts`);
  const diagnostics = ts.getPreEmitDiagnostics(fixturesProgram());
  const edge = diagnostics.filter(diagnostic => diagnostic.file && ts.sys.resolvePath(diagnostic.file.fileName) === edgeFile);
  const ordinary = diagnostics.filter(diagnostic => !diagnostic.file || ts.sys.resolvePath(diagnostic.file.fileName) !== edgeFile);
  assert.deepEqual(ordinary.map(diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')), []);
  assert.deepEqual(edge.map(diagnostic => {
    const position = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
    return {
      line: position.line + 1,
      column: position.character + 1,
      code: diagnostic.code,
      category: diagnostic.category,
      message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
    };
  }), [
    {
      line: 13, column: 49, code: 2769, category: ts.DiagnosticCategory.Error,
      message: "No overload matches this call.\n"
        + "  Overload 1 of 2, '(create: Factory, dispose: (this: void, value: unknown) => void | Promise<void>): FactoryWithDisposal<Factory>', gave the following error.\n"
        + "    Argument of type 'unknown' is not assignable to parameter of type 'Factory'.\n"
        + "  Overload 2 of 2, '(provider: Registration, dispose: (this: void, value: unknown) => void | Promise<void>): Provider<Factory | ((this: void, deps: unknown) => unknown), object, readonly unknown[], OpaqueGraph, unknown>', gave the following error.\n"
        + "    Argument of type 'unknown' is not assignable to parameter of type 'Registration'.",
    },
    {
      line: 15, column: 70, code: 1117, category: ts.DiagnosticCategory.Error,
      message: 'An object literal cannot have multiple properties with the same name.',
    },
  ]);
  assert.ok(fixtureNames.length >= 8, `found ${fixtureNames.length} fixtures`);
});

for (const name of fixtureNames) {
  test(`fixture ${name}: rewritten text and manual items`, () => {
    const result = runFixture(name);
    assert.equal(result.text, readFixture(name, 'expected.ts'));
    assert.deepEqual(result.manual, JSON.parse(readFixture(name, 'expected-manual.json')));
  });
}

test('an untraceable token keeps its kind manual while proven constructor and contribution calls migrate', () => {
  const result = runFixture('collection-token-untraceable');
  assert.equal(result.text, readFixture('collection-token-untraceable', 'expected.ts'));
  assert.deepEqual(result.manual, JSON.parse(readFixture('collection-token-untraceable', 'expected-manual.json')));
  assert.match(result.text, /\.of<number>\(\)/);
  assert.doesNotMatch(result.text, /\.for(?:Service|CollectionOf)<number>\(\)/);
});

test('qualified typeof references follow uncalled member policy without escaping manual preservation', () => {
  const result = runFixture('qualified-references');
  assert.equal(result.text, readFixture('qualified-references', 'expected.ts'));
  assert.deepEqual(result.manual, JSON.parse(readFixture('qualified-references', 'expected-manual.json')));
  assert.equal(result.rewrites, 10);
});

test('expected output contains no old spelling for unconditional method renames', () => {
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
