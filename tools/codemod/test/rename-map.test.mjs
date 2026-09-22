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
const shippedTransforms = ['build-and-start', 'collection-read', 'collection-reference', 'collection-token'];
after(() => rmSync(temporaryRoot, { force: true, recursive: true }));

test('the shipped map is valid', () => {
  assert.deepEqual(validateRenameMap(shipped, shippedTransforms), []);
  assert.equal(loadRenameMap(join(packageRoot, 'rename-map.json'), shippedTransforms).version, 1);
});

test('loading a broken map throws one error that lists every problem', () => {
  assert.throws(() => loadRenameMap(join(packageRoot, 'package.json'), []), /invalid rename map .*package\.json:\nversion must be 1\nunknown section name/);
});

test('the schema file lists the same sections the validator accepts', () => {
  const schema = JSON.parse(readFileSync(join(packageRoot, 'rename-map.schema.json'), 'utf8'));
  assert.deepEqual(Object.keys(schema.properties).sort(), ['$schema', 'codes', 'imports', 'methods', 'options', 'properties', 'types', 'values', 'version']);
  assert.deepEqual(schema.properties.methods.items.properties.transformNames, {
    type: 'object',
    minProperties: 1,
    additionalProperties: { type: 'string', minLength: 1 },
  });
  const method = schema.properties.methods.items;
  assert.equal(method.properties.arguments.oneOf[0].properties.alreadyBag.const, true);
  assert.equal(method.properties.arguments.oneOf[0].allOf[0].then.properties.names.maxItems, 1);
  const nonEmpty = [
    schema.properties.$schema,
    method.properties.owner, method.properties.from, method.properties.to, method.properties.transform,
    method.properties.arguments.oneOf[0].properties.names.items,
    method.properties.arguments.oneOf[0].properties.trailing.properties.keys.additionalProperties,
    schema.properties.options.items.properties.owner, schema.properties.options.items.properties.method,
    schema.properties.options.items.properties.path.items, schema.properties.options.items.properties.from,
    ...schema.properties.values.items.oneOf.flatMap(variant => Object.values(variant.properties).filter(property => property.type === 'string')),
    ...Object.values(schema.properties.properties.items.properties),
    ...Object.values(schema.properties.types.items.properties),
    ...Object.values(schema.properties.codes.items.properties).filter(property => property.type === 'string'),
    ...schema.properties.imports.items.oneOf.flatMap(variant => Object.values(variant.properties)),
  ];
  for (const field of nonEmpty) assert.equal(field.minLength, 1);
  assert.deepEqual(method.allOf, [
    { not: { required: ['arguments', 'transform'] } },
    { if: { required: ['transformNames'] }, then: { required: ['transform'] } },
  ]);
  assert.equal(method.properties.to.pattern, '^[A-Za-z_$][A-Za-z0-9_$]*$');
  assert.equal(schema.properties.properties.items.properties.to.pattern, method.properties.to.pattern);
  assert.equal(schema.properties.types.items.properties.to.pattern, method.properties.to.pattern);
  assert.ok(schema.properties.types.items.properties.to.not.enum.includes('string'));
  assert.ok(schema.properties.types.items.properties.to.not.enum.includes('default'));
  assert.ok(schema.properties.types.items.properties.to.not.enum.includes('abstract'));
});

test('malformed JSON is framed with the rename-map file path', () => {
  const file = join(temporaryRoot, 'invalid-json.json');
  writeFileSync(file, '{');
  assert.throws(() => loadRenameMap(file), error => error.message.startsWith(`invalid rename map ${file}:\n`) && error.message.length > file.length + 22);
});

test('custom-transform role names survive loading the shipped map', () => {
  const loaded = loadRenameMap(join(packageRoot, 'rename-map.json'), shippedTransforms);
  const entry = loaded.methods.find(method => method.owner === 'Builder' && method.from === 'buildAndStart');
  assert.deepEqual(entry.transformNames, { concurrency: 'maxConcurrentServiceKeys' });
});

test('custom-transform role names require a transform and non-empty targets', () => {
  assert.deepEqual(validateRenameMap({
    version: 1,
    methods: [{ owner: 'Builder', from: 'buildAndStart', to: 'ensureServicesReady', transformNames: { concurrency: '' } }],
  }, ['build-and-start']), [
    'methods[0]: transformNames requires transform',
    'methods[0]: transformNames must map at least one role to a non-empty string',
  ]);
});

test('method conflicts include custom-transform role names', () => {
  assert.deepEqual(validateRenameMap({
    version: 1,
    methods: [
      { owner: 'Builder', from: 'buildAndStart', to: 'ensureServicesReady', transform: 'build-and-start', transformNames: { concurrency: 'limit' } },
      { owner: 'Builder', from: 'buildAndStart', to: 'ensureServicesReady', transform: 'build-and-start', transformNames: { concurrency: 'capacity' } },
    ],
  }, ['build-and-start']), [
    'methods[1]: conflicts with methods[0] for Builder.buildAndStart',
  ]);
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

test('nameOf returns a common target independent of arity-specific argument plans', () => {
  const index = indexRenameMap({ version: 1, methods: [
    { owner: 'Bag', from: 'createScope', to: 'createChildContainer', arity: [0, 1] },
    { owner: 'Bag', from: 'createScope', to: 'createChildContainer', arity: [2, 3], arguments: { kind: 'bag', names: ['keys', 'providers'] } },
  ] });
  assert.equal(index.nameOf('Bag', 'createScope'), 'createChildContainer');
  assert.equal(index.methodFor('Bag', 'createScope', undefined), undefined);
});

test('validation aligns schema combinations and rejects unsafe emitted API targets', () => {
  assert.deepEqual(validateRenameMap({
    version: 1,
    $schema: '',
    methods: [
      { owner: 'Builder', from: 'build', to: 'new-name' },
      { owner: 'Builder', from: 'shape', to: 'shape', arguments: { kind: 'array' }, transform: 'known' },
      { owner: 'Builder', from: 'role', to: 'role', transformNames: { result: 'result' } },
    ],
    properties: [{ owner: 'Bag', from: 'size', to: 'capacity limit' }],
    types: [{ from: 'OldBag', to: 'string' }, { from: 'OlderBag', to: 'abstract' }],
  }, ['known']), [
    '$schema must be a non-empty string',
    'methods[0]: to must be a safe bare identifier',
    'methods[1]: use either transform or arguments',
    'methods[2]: transformNames requires transform',
    'properties[0]: to must be a safe bare identifier',
    'types[0]: to must be a safe type identifier',
    'types[1]: to must be a safe type identifier',
  ]);
});

test('an entry with arity applies only to calls with that many arguments', () => {
  const map = { version: 1, methods: [
    { owner: 'Builder', from: 'register', to: 'withServices', arity: [1] },
    { owner: 'Builder', from: 'register', to: 'withTokenService', arity: [2] },
  ] };
  assert.deepEqual(validateRenameMap(map), []);
  const index = indexRenameMap(map);
  assert.equal(index.methodFor('Builder', 'register', 1).to, 'withServices');
  assert.equal(index.methodFor('Builder', 'register', 2).to, 'withTokenService');
  assert.equal(index.methodFor('Builder', 'register', 3), undefined);
  assert.equal(index.methodFor('Builder', 'register', undefined), undefined);
  assert.equal(index.nameOf('Builder', 'register'), 'register');
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

test('validation rejects unexpected fields at every schema object boundary', () => {
  assert.deepEqual(validateRenameMap({
    version: 1,
    methods: [
      { owner: 'Builder', from: 'a', to: 'b', extra: true },
      { owner: 'Builder', from: 'c', to: 'd', arguments: { kind: 'bag', names: ['value'], extra: true } },
      { owner: 'Builder', from: 'e', to: 'f', arguments: { kind: 'bag', names: ['value'], trailing: { mode: 'keep', extra: true } } },
      { owner: 'Builder', from: 'g', to: 'h', arguments: { kind: 'array', names: ['value'] } },
    ],
    options: [{ owner: 'Bag', method: 'close', argument: 0, from: 'a', to: 'b', extra: true }],
    values: [{ owner: 'Result', property: 'status', from: 'a', to: 'b', extra: true }],
    properties: [{ owner: 'Token', from: 'key', to: 'symbol', extra: true }],
    types: [{ from: 'Old', to: 'New', extra: true }],
    codes: [{ from: 'DI_BAG_OLD', to: 'DI_BAG_NEW', extra: true }],
    imports: [{ from: 'old', to: 'new', extra: true }],
  }), [
    'methods[0]: unknown field extra',
    'methods[1]: arguments has unknown field extra',
    'methods[2]: arguments.trailing has unknown field extra',
    'methods[3]: arguments has unknown field names',
    'options[0]: unknown field extra',
    'values[0]: unknown field extra',
    'properties[0]: unknown field extra',
    'types[0]: unknown field extra',
    'codes[0]: unknown field extra',
    'imports[0]: unknown field extra',
  ]);
});

test('alreadyBag is a closed true-only bag argument flag', () => {
  assert.deepEqual(validateRenameMap({
    version: 1,
    methods: [{ owner: 'Builder', from: 'buildModule', to: 'buildModule', arguments: { kind: 'bag', names: ['exportedServiceKeys'], alreadyBag: true } }],
  }), []);
  assert.deepEqual(validateRenameMap({
    version: 1,
    methods: [{ owner: 'Builder', from: 'buildModule', to: 'buildModule', arguments: { kind: 'bag', names: ['exportedServiceKeys'], alreadyBag: false } }],
  }), ['methods[0]: arguments.alreadyBag must be true when present']);
  assert.deepEqual(validateRenameMap({
    version: 1,
    methods: [
      { owner: 'Builder', from: 'old', to: 'new', arguments: { kind: 'bag', names: ['value'], alreadyBag: true } },
      { owner: 'Builder', from: 'same', to: 'same', arguments: { kind: 'bag', names: ['first', 'second'], alreadyBag: true } },
    ],
  }), [
    'methods[0]: arguments.alreadyBag requires a same-name method with exactly one argument name',
    'methods[1]: arguments.alreadyBag requires a same-name method with exactly one argument name',
  ]);
});

test('validation requires exact field-presence variants', () => {
  assert.deepEqual(validateRenameMap({
    version: 1,
    values: [
      { owner: 'Result', method: 'read', argument: 0, property: 'status', from: 'a', to: 'b' },
      { owner: 'Result', method: 'read', from: 'a', to: 'b' },
      { owner: 'Result', property: 'status', path: [], from: 'a', to: 'b' },
    ],
    properties: [{ owner: 'Token', from: 'key', to: null, manual: 'choose by hand' }],
    codes: [{ from: 'DI_BAG_OLD', to: null, manual: 'choose by hand' }],
    imports: [
      { from: 'old', to: 'new', fromSuffix: '/old', toSuffix: '/new' },
      { from: 'old', toSuffix: '/new' },
      { from: 'old', to: 'new', fromSuffix: null },
    ],
  }), [
    'values[0]: owner, from, to and either method with argument or property are required',
    'values[1]: owner, from, to and either method with argument or property are required',
    'values[2]: owner, from, to and either method with argument or property are required',
    'properties[0]: owner, from and exactly one of to or manual are required',
    'codes[0]: from must be a DI_BAG_ code with exactly one of to or manual',
    'imports[0]: use either from with to, or fromSuffix with toSuffix',
    'imports[1]: use either from with to, or fromSuffix with toSuffix',
    'imports[2]: use either from with to, or fromSuffix with toSuffix',
  ]);
});

test('validation rejects conflicting effective selectors in every map section', () => {
  assert.deepEqual(validateRenameMap({
    version: 1,
    methods: [
      { owner: 'Builder', from: 'register', to: 'withServices', arity: [1] },
      { owner: 'Builder', from: 'register', to: 'withTokenService', arity: [2] },
      { owner: 'Builder', from: 'register', to: 'other', arity: [1, 3] },
      { owner: 'Builder', from: 'build', to: 'buildContainer' },
      { owner: 'Builder', from: 'build', to: 'otherBuild', arity: [0] },
    ],
    options: [
      { owner: 'Bag', method: 'close', argument: 0, path: ['nested'], from: 'signal', to: 'abortSignal' },
      { owner: 'Bag', method: 'close', argument: 0, path: ['nested'], from: 'signal', to: 'otherSignal' },
    ],
    values: [
      { owner: 'Bag', method: 'close', argument: 0, path: ['mode'], from: 'old', to: 'new' },
      { owner: 'Bag', method: 'close', argument: 0, path: ['mode'], from: 'old', to: 'other' },
      { owner: 'LifecycleEvent', property: 'kind', from: 'old', to: 'new' },
      { owner: 'LifecycleEvent', property: 'kind', from: 'old', to: 'other' },
    ],
    properties: [
      { owner: 'Token', from: 'key', to: 'symbol' },
      { owner: 'Token', from: 'key', manual: 'choose by hand' },
    ],
    types: [{ from: 'Bag', to: 'Container' }, { from: 'Bag', to: 'OtherContainer' }],
    codes: [{ from: 'DI_BAG_OLD', to: 'DI_BAG_NEW' }, { from: 'DI_BAG_OLD', manual: 'choose by hand' }],
    imports: [{ from: './node', to: './index' }, { from: './node', to: './other' }],
  }), [
    'methods[2]: conflicts with methods[0] for Builder.register',
    'methods[4]: conflicts with methods[3] for Builder.build',
    'options[1]: conflicts with options[0] for Bag.close argument 1 path nested key signal',
    'values[1]: conflicts with values[0] for Bag.close argument 1 path mode value old',
    'values[3]: conflicts with values[2] for LifecycleEvent.kind value old',
    'properties[1]: conflicts with properties[0] for Token.key',
    'types[1]: conflicts with types[0] for Bag',
    'codes[1]: conflicts with codes[0] for DI_BAG_OLD',
    'imports[1]: conflicts with imports[0] for overlapping import selectors',
  ]);
});

test('validation rejects incompatible overlapping exact and suffix import selectors', () => {
  assert.deepEqual(validateRenameMap({
    version: 1,
    imports: [
      { from: './src/node', to: './src' },
      { fromSuffix: '/node', toSuffix: '/index' },
      { fromSuffix: '/src/node', toSuffix: '/other' },
    ],
  }), [
    'imports[1]: conflicts with imports[0] for overlapping import selectors',
    'imports[2]: conflicts with imports[0] for overlapping import selectors',
    'imports[2]: conflicts with imports[1] for overlapping import selectors',
  ]);
});

test('validation allows overlapping import selectors with the same effective result', () => {
  assert.deepEqual(validateRenameMap({
    version: 1,
    imports: [
      { from: './src/node', to: './src/index' },
      { fromSuffix: '/node', toSuffix: '/index' },
      { fromSuffix: '/src/node', toSuffix: '/src/index' },
    ],
  }), []);
});
