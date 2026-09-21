// tools/codemod/test/rename-map.test.mjs
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { after, test } from 'node:test';
import { indexRenameMap, loadRenameMap, validateRenameMap } from '../lib/rename-map.mjs';

const packageRoot = resolve(import.meta.dirname, '..');
const shipped = JSON.parse(readFileSync(join(packageRoot, 'rename-map.json'), 'utf8'));
const temporaryRoot = mkdtempSync(join(tmpdir(), 'di-bag-rename-map-'));
after(() => rmSync(temporaryRoot, { force: true, recursive: true }));

test('the shipped map is valid', () => {
  assert.deepEqual(validateRenameMap(shipped, ['build-and-start']), []);
  assert.equal(loadRenameMap(join(packageRoot, 'rename-map.json'), ['build-and-start']).version, 1);
});

test('loading a broken map throws one error that lists every problem', () => {
  assert.throws(() => loadRenameMap(join(packageRoot, 'package.json'), []), /invalid rename map .*package\.json:\nversion must be 1\nunknown section name/);
});

test('the schema file lists the same sections the validator accepts', () => {
  const schema = JSON.parse(readFileSync(join(packageRoot, 'rename-map.schema.json'), 'utf8'));
  assert.deepEqual(Object.keys(schema.properties).sort(), ['$schema', 'codes', 'imports', 'methods', 'options', 'properties', 'types', 'values', 'version']);
});

test('validation names every problem', () => {
  const problems = validateRenameMap({
    version: 2,
    surprises: [],
    methods: [{ owner: 'Builder', from: 'alias' }, { owner: 'Builder', from: 'x', to: 'y', transform: 'missing' }, { owner: 'Builder', from: 'a', to: 'b', arguments: { kind: 'tuple' } }],
    properties: [{ owner: 'Token', from: 'key', to: 'symbol', manual: 'both' }],
    codes: [{ from: 'NOT_A_CODE', to: 'DI_BAG_X' }],
    imports: [{ from: 'a' }],
    values: [{ owner: 'X', from: 'a', to: 'b' }],
  }, []);
  assert.deepEqual(problems, [
    'version must be 1',
    'unknown section surprises',
    'methods[0]: owner, from and to are required strings',
    'methods[1]: unknown transform missing',
    'methods[2]: arguments.kind must be bag or array',
    'values[0]: owner, from, to and either method with argument or property are required',
    'properties[0]: owner, from and exactly one of to or manual are required',
    'codes[0]: from must be a DI_BAG_ code with exactly one of to or manual',
    'imports[0]: use either from with to, or fromSuffix with toSuffix',
  ]);
});

test('nameOf answers from the map and falls back to the old name', () => {
  const index = indexRenameMap({ version: 1, methods: [{ owner: 'Builder', from: 'build', to: 'buildContainer' }], properties: [{ owner: 'Token', from: 'key', to: 'symbol' }] });
  assert.equal(index.nameOf('Builder', 'build'), 'buildContainer');
  assert.equal(index.nameOf('Token', 'key'), 'symbol');
  assert.equal(index.nameOf('Builder', 'register'), 'register');
});

test('an entry with arity applies only to calls with that many arguments', () => {
  const index = indexRenameMap({ version: 1, methods: [
    { owner: 'Builder', from: 'register', to: 'withServices', arity: [1] },
    { owner: 'Builder', from: 'register', to: 'withTokenService', arity: [2] },
  ] });
  assert.equal(index.methodFor('Builder', 'register', 1).to, 'withServices');
  assert.equal(index.methodFor('Builder', 'register', 2).to, 'withTokenService');
  assert.equal(index.methodFor('Builder', 'register', 3), undefined);
});

test("a code whose target is the word manual is reported, never rewritten", () => {
  const index = indexRenameMap({ version: 1, codes: [{ from: 'DI_BAG_INVALID_SCOPE', to: 'manual' }, { from: 'DI_BAG_CYCLE', to: 'DI_BAG_DEPENDENCY_CYCLE' }] });
  assert.equal(index.codes.get('DI_BAG_INVALID_SCOPE').to, undefined);
  assert.match(index.codes.get('DI_BAG_INVALID_SCOPE').manual, /split/);
  assert.equal(index.codes.get('DI_BAG_CYCLE').to, 'DI_BAG_DEPENDENCY_CYCLE');
});

test('non-array sections are reported without preventing other validation', () => {
  assert.deepEqual(validateRenameMap({
    version: 2,
    methods: {},
    options: 'bad',
    values: null,
    properties: 0,
    types: false,
    codes: {},
    imports: '',
  }), [
    'version must be 1',
    'methods must be an array',
    'options must be an array',
    'values must be an array',
    'properties must be an array',
    'types must be an array',
    'codes must be an array',
    'imports must be an array',
  ]);
});

test('non-object entries and nested method shapes are reported without throwing', () => {
  assert.deepEqual(validateRenameMap({
    version: 1,
    methods: [null, { owner: 'Builder', from: 'a', to: 'b', arguments: null }, { owner: 'Builder', from: 'c', to: 'd', arguments: { kind: 'bag', names: ['x'], trailing: null } }],
    options: [null],
    values: [null],
    properties: [null],
    types: [null],
    codes: [null],
    imports: [null],
  }), [
    'methods[0]: entry must be an object',
    'methods[1]: arguments must be an object',
    'methods[2]: arguments.trailing must be an object',
    'options[0]: entry must be an object',
    'values[0]: entry must be an object',
    'properties[0]: entry must be an object',
    'types[0]: entry must be an object',
    'codes[0]: entry must be an object',
    'imports[0]: entry must be an object',
  ]);
});

test('paths and numeric positions follow the schema constraints', () => {
  assert.deepEqual(validateRenameMap({
    version: 1,
    methods: [{ owner: 'Builder', from: 'a', to: 'b', arity: [-1, 1.5] }],
    options: [
      { owner: 'Bag', method: 'close', argument: -1, from: 'a', to: 'b' },
      { owner: 'Bag', method: 'close', argument: 0, path: null, from: 'a', to: 'b' },
      { owner: 'Bag', method: 'close', argument: 0, path: 'nested', from: 'a', to: 'b' },
      { owner: 'Bag', method: 'close', argument: 0, path: ['nested', 1], from: 'a', to: 'b' },
      { owner: 'Bag', method: 'close', argument: 0, path: [], from: 'a', to: 'b' },
    ],
    values: [
      { owner: 'Bag', method: 'close', argument: 0.5, from: 'a', to: 'b' },
      { owner: 'Bag', method: 'close', argument: 0, path: null, from: 'a', to: 'b' },
      { owner: 'Bag', method: 'close', argument: 0, path: 'nested', from: 'a', to: 'b' },
      { owner: 'Bag', method: 'close', argument: 0, path: ['nested', 1], from: 'a', to: 'b' },
      { owner: 'Bag', method: 'close', argument: 0, path: [], from: 'a', to: 'b' },
    ],
  }), [
    'methods[0]: arity must be an array of non-negative integers',
    'options[0]: argument must be a non-negative integer',
    'options[1]: path must be an array of property names',
    'options[2]: path must be an array of property names',
    'options[3]: path must be an array of property names',
    'values[0]: argument must be a non-negative integer',
    'values[1]: path must be an array of property names',
    'values[2]: path must be an array of property names',
    'values[3]: path must be an array of property names',
  ]);
});

test('loading malformed JSON-shaped data throws one error containing every problem', () => {
  const file = join(temporaryRoot, 'broken-map.json');
  writeFileSync(file, JSON.stringify({ version: 2, surprise: true, methods: {} }));
  assert.throws(
    () => loadRenameMap(file),
    /invalid rename map .*broken-map\.json:\nversion must be 1\nunknown section surprise\nmethods must be an array/,
  );
});

test('path lookups preserve segment identity and test descendants by segment', () => {
  const index = indexRenameMap({
    version: 1,
    options: [
      { owner: 'Bag', method: 'close', argument: 0, path: ['a.b'], from: 'literal', to: 'literalNew' },
      { owner: 'Bag', method: 'close', argument: 0, path: ['a', 'b'], from: 'nested', to: 'nestedNew' },
      { owner: 'Bag', method: 'literalOnly', argument: 0, path: ['a.b'], from: 'x', to: 'y' },
      { owner: 'Bag', method: 'prefixOnly', argument: 0, path: ['ab'], from: 'x', to: 'y' },
    ],
    values: [
      { owner: 'Bag', method: 'close', argument: 0, path: ['a.b'], from: 'literal-value', to: 'literal-new' },
      { owner: 'Bag', method: 'close', argument: 0, path: ['a', 'b'], from: 'nested-value', to: 'nested-new' },
    ],
  });

  assert.deepEqual(index.optionsFor('Bag', 'close', 0, ['a.b']).map(entry => entry.from), ['literal']);
  assert.deepEqual(index.optionsFor('Bag', 'close', 0, ['a', 'b']).map(entry => entry.from), ['nested']);
  assert.deepEqual(index.valuesFor('Bag', 'close', 0, ['a.b']).map(entry => entry.from), ['literal-value']);
  assert.deepEqual(index.valuesFor('Bag', 'close', 0, ['a', 'b']).map(entry => entry.from), ['nested-value']);
  assert.equal(index.hasEntriesBelow('Bag', 'close', 0, ['a']), true);
  assert.equal(index.hasEntriesBelow('Bag', 'literalOnly', 0, ['a']), false);
  assert.equal(index.hasEntriesBelow('Bag', 'prefixOnly', 0, ['a']), false);
});
