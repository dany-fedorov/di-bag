import { expect, test } from 'bun:test';
import { matchNativeDiagnosticMarkers } from './native-diagnostic-markers';

const message = "No overload matches this call.\n  The last overload gave the following error.\n    Argument of type 'string' is not assignable to parameter of type 'TokenBase & { readonly [errorBrand]: \"token must be an individually known genuine handle; see https://dany-fedorov.github.io/di-bag/agent/errors.html#unknown-key\"; }'.\n      Type 'string' is not assignable to type 'TokenBase'.";
const source = '// diagnostic: provided service does not satisfy its consumer dependency\n// diagnostic-native-gap: last-token-string\nreplace();';
const error = { file: '/fixture.ts', line: 3, code: 2769, message };
test('known native overload rejection retains its unmet useful requirement separately', () => {
  const result = matchNativeDiagnosticMarkers(source, '/fixture.ts', [error]);
  expect(result).toMatchObject({ accepted: true, status: 'accepted-with-diagnostic-gaps', primaryExpected: 1, primaryMatched: 0,
    knownNativeRejections: 1, supplementalExpected: 0, supplementalMatched: 0, unexpected: [], unresolved: [], declarationErrors: [] });
  expect(result.gaps[0]!.primary.message).toBe('provided service does not satisfy its consumer dependency');
});
for (const [name, changed, errors] of [
  ['unknown declaration', source.replace('last-token-string', 'unknown'), [error]],
  ['malformed declaration', source.replace('gap:', 'gap'), [error]],
  ['duplicate declaration', source.replace('replace();', '// diagnostic-native-gap: last-token-string\nreplace();'), [{ ...error, line: 4 }]],
  ['misplaced declaration', '// diagnostic-native-gap: last-token-string\n// diagnostic: provided service does not satisfy its consumer dependency\nreplace();', [error]],
  ['not adjacent', source.replace('gap:', 'gap:').replace('\n// diagnostic-native', '\n\n// diagnostic-native'), [{ ...error, line: 4 }]],
  ['stale declaration', source, [{ ...error, message: 'provided service does not satisfy its consumer dependency' }]],
  ['wrong code', source, [{ ...error, code: 2345 }]],
  ['wrong full message', source, [{ ...error, message: message + '\nextra' }]],
  ['wrong file', source, [{ ...error, file: '/config.json' }]],
  ['wrong region', source + '\n// diagnostic: elsewhere\nother();', [{ ...error, line: 5 }]],
  ['absent error', source, []],
  ['TS2589', source, [{ ...error, code: 2589 }]],
  ['duplicate error', source, [error, error]],
  ['unrelated extra', source, [error, { ...error, message: 'unrelated' }]],
  ['no declaration', source.replace('// diagnostic-native-gap: last-token-string\n', ''), [{ ...error, line: 2 }]],
] as const) test(`native gap rejects ${name}`, () => {
  expect(matchNativeDiagnosticMarkers(changed, '/fixture.ts', errors).accepted).toBe(false);
});
test('native gap cannot replace a supplemental expectation', () => {
  const text = source.replace('replace();', '// diagnostic-also: TS2684 required services are missing\nreplace();');
  expect(matchNativeDiagnosticMarkers(text, '/fixture.ts', [{ ...error, line: 4 }]).accepted).toBe(false);
});

test('union and open-template fingerprints require their own exact declarations', () => {
  const union = message.replace("      Type 'string' is not assignable to type 'TokenBase'.",
    "      Type 'string' is not assignable to type 'TokenBase & { readonly [errorBrand]: \"token must be an individually known genuine handle; see https://dany-fedorov.github.io/di-bag/agent/errors.html#unknown-key\"; }'.\n        Type 'string' is not assignable to type 'TokenBase'.");
  const template = message.replaceAll("'string'", "'`a${string}`'");
  for (const [id, full] of [['last-token-string-union', union], ['last-token-open-template', template]]) {
    const declared = source.replace('last-token-string', id!);
    expect(matchNativeDiagnosticMarkers(declared, '/fixture.ts', [{ ...error, message: full! }]).accepted).toBe(true);
    expect(matchNativeDiagnosticMarkers(source, '/fixture.ts', [{ ...error, message: full! }]).accepted).toBe(false);
    expect(matchNativeDiagnosticMarkers(declared, '/fixture.ts', [error]).accepted).toBe(false);
  }
});

test('native gap cannot satisfy a different primary even when that primary matches its fingerprint', () => {
  const text = source + '\n// diagnostic: required services are missing\nend();';
  const result = matchNativeDiagnosticMarkers(text, '/fixture.ts', [error]);
  expect(result.accepted).toBe(false);
  expect(result.unresolved.map(marker => marker.message)).toEqual(['required services are missing']);
});

const contextualFingerprints = [
  { id: 'last-contextual-factory-thenable', oldContext: true, full: "No overload matches this call.\n  The last overload gave the following error.\n    Argument of type '(this: void, _deps: {}, context: FactoryContext) => QueryBuilder' is not assignable to parameter of type 'Factory'.\n      Target signature provides too few arguments. Expected 2 or more, but got 1." },
  { id: 'last-contextual-sync-factory-promise', oldContext: true, full: "No overload matches this call.\n  The last overload gave the following error.\n    Argument of type '(this: void, _deps: {}, _factoryCtx: FactoryContext) => Promise<number>' is not assignable to parameter of type 'Factory'.\n      Target signature provides too few arguments. Expected 2 or more, but got 1." },
  { id: 'last-contextual-native-factory-number', full: "No overload matches this call.\n  The last overload gave the following error.\n    Argument of type '(_deps: {}, _factoryCtx: FactoryContext) => number' is not assignable to parameter of type 'Factory'.\n      Target signature provides too few arguments. Expected 2 or more, but got 1." },
  { id: 'last-provider-context-shape', full: "No overload matches this call.\n  The last overload gave the following error.\n    Argument of type '(_dependencies: {}, factoryContext: { readonly abortSignal: string; }) => { readonly abortSignal: string; }' is not assignable to parameter of type 'Factory'.\n      Target signature provides too few arguments. Expected 2 or more, but got 1." },
  { id: 'last-provider-contextual-native-number', full: "No overload matches this call.\n  The last overload gave the following error.\n    Argument of type '(this: void, _dependencies: {}, _factoryContext: FactoryContext) => number' is not assignable to parameter of type 'Factory'.\n      Target signature provides too few arguments. Expected 2 or more, but got 1." },
  { id: 'last-provider-contextual-sync-promise', full: "No overload matches this call.\n  The last overload gave the following error.\n    Argument of type '(this: void, _dependencies: {}, _factoryContext: FactoryContext) => Promise<number>' is not assignable to parameter of type 'Factory'.\n      Target signature provides too few arguments. Expected 2 or more, but got 1." },
  { id: 'last-provider-contextual-thenable', full: "No overload matches this call.\n  The last overload gave the following error.\n    Argument of type '(this: void, _dependencies: {}, _factoryContext: FactoryContext) => { then(_resolve: (value: number) => void): void; }' is not assignable to parameter of type 'Factory'.\n      Target signature provides too few arguments. Expected 2 or more, but got 1." },
] as const;

const providerFacadeFingerprints = [
  {
    id: 'last-provider-acquisition-mode',
    primary: 'Type \'"later"\' is not assignable to type \'"exposed-service"\'',
    full: "No overload matches this call.\n  The last overload gave the following error.\n    Type '\"later\"' is not assignable to type '\"fulfilled-value\"'.",
  },
  {
    id: 'last-provider-transform-fulfilled-mode',
    primary: "Type 'string' is not assignable to type 'never'",
    full: "No overload matches this call.\n  The last overload gave the following error.\n    Type '\"fulfilled-value\"' is not assignable to type '\"exposed-service\"'.",
  },
] as const;

for (const fingerprint of providerFacadeFingerprints) test(`provider facade native gap requires exact fingerprint for ${fingerprint.id}`, () => {
  const declared = `// diagnostic: ${fingerprint.primary}\n// diagnostic-native-gap: ${fingerprint.id}\nreject();`;
  const native = { file: '/fixture.ts', line: 3, column: 1, code: 2769, message: fingerprint.full };
  const accepted = matchNativeDiagnosticMarkers(declared, '/fixture.ts', [native]);
  expect(accepted).toMatchObject({
    accepted: true,
    status: 'accepted-with-diagnostic-gaps',
    primaryExpected: 1,
    primaryMatched: 0,
    knownNativeRejections: 1,
    unexpected: [],
    unresolved: [],
    declarationErrors: [],
  });
  expect(accepted.gaps).toHaveLength(1);
  expect(accepted.gaps[0]!.primary.message).toBe(fingerprint.primary);

  const other = providerFacadeFingerprints.find(candidate => candidate.id !== fingerprint.id)!;
  const adversarial = [
    ['no declaration', declared.replace(`// diagnostic-native-gap: ${fingerprint.id}\n`, ''), [{ ...native, line: 2 }]],
    ['absent diagnostic', declared, []],
    ['duplicate declaration', declared.replace('reject();', `// diagnostic-native-gap: ${fingerprint.id}\nreject();`), [{ ...native, line: 4 }]],
    ['duplicate diagnostic', declared, [native, { ...native }]],
    ['wrong code', declared, [{ ...native, code: 2345 }]],
    ['TS2589', declared, [{ ...native, code: 2589 }]],
    ['altered complete message', declared, [{ ...native, message: `${fingerprint.full}\nextra` }]],
    ['other fingerprint', declared, [{ ...native, message: other.full }]],
    ['wrong file', declared, [{ ...native, file: '/other.ts' }]],
    ['wrong region', `${declared}\n// diagnostic: neighboring useful rejection\nneighbor();`, [{ ...native, line: 5 }]],
    ['unrelated additional error', declared, [native, { ...native, message: 'unrelated' }]],
    ['stale declaration', declared, [{ ...native, code: 2345, message: fingerprint.primary }]],
  ] as const;
  for (const [name, changed, errors] of adversarial) {
    expect(matchNativeDiagnosticMarkers(changed, '/fixture.ts', errors).accepted, name).toBe(false);
  }
});

for (const fingerprint of contextualFingerprints) test(`contextual native gap requires exact fingerprint for ${fingerprint.id}`, () => {
  const declared = `// diagnostic: useful contextual rejection\n// diagnostic-native-gap: ${fingerprint.id}\nreject();`;
  const native = { file: '/fixture.ts', line: 3, code: 2769, message: fingerprint.full };
  const accepted = matchNativeDiagnosticMarkers(declared, '/fixture.ts', [native]);
  expect(accepted).toMatchObject({ accepted: true, primaryMatched: 0, knownNativeRejections: 1,
    unexpected: [], unresolved: [], declarationErrors: [] });
  if ('oldContext' in fingerprint) {
    expect(matchNativeDiagnosticMarkers(declared, '/fixture.ts', [{ ...native, message: fingerprint.full.replace('FactoryContext', ['Acquisition', 'Context'].join('')) }]).accepted).toBe(false);
  }
  for (const other of contextualFingerprints) {
    if (other.id === fingerprint.id) continue;
    expect(matchNativeDiagnosticMarkers(declared, '/fixture.ts', [{ ...native, message: other.full }]).accepted).toBe(false);
  }
  expect(matchNativeDiagnosticMarkers(declared, '/fixture.ts', [native, { ...native, message: 'unrelated' }]).accepted).toBe(false);
  expect(matchNativeDiagnosticMarkers(declared, '/fixture.ts', [{ ...native, code: 2345, message: 'useful contextual rejection' }]).accepted).toBe(false);
});
