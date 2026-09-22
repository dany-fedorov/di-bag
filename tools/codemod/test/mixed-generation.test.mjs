import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { runCodemod } from '../lib/codemod.mjs';
import { compiler } from './helpers.mjs';

const root = mkdtempSync(join(tmpdir(), 'di-bag-mixed-generation-'));
const libraryRoot = join(root, 'lib');
const library = join(libraryRoot, 'library.d.ts');
const source = join(root, 'input.ts');
after(() => rmSync(root, { force: true, recursive: true }));

mkdirSync(libraryRoot);
writeFileSync(library, `
interface Builder {
  register(services: Record<string, () => unknown>): Builder;
  withServices(services: Record<string, () => unknown>): Builder;
  buildModule(keys: readonly PropertyKey[], options?: { label?: string }): unknown;
  buildModule(options: { exportedServiceKeys: readonly PropertyKey[]; moduleLabel?: string; nested?: Builder }): unknown;
  buildModule(value: unknown, options?: unknown): unknown;
}
declare const builder: Builder;
`);

const input = `const inlineBag = builder.buildModule({ exportedServiceKeys: ['inline'] as const });
const inferredBag = { exportedServiceKeys: ['inferred'] as const };
builder.buildModule(inferredBag);
type ModuleBag = { exportedServiceKeys: readonly ['typed'] };
const typedBag: ModuleBag = { exportedServiceKeys: ['typed'] };
builder.buildModule(typedBag);
builder.buildModule(['inline-tuple'] as const);
const namedTuple = ['named-tuple'] as const;
builder.buildModule(namedTuple);
const readonlyTuple: readonly ['typed-tuple'] = ['typed-tuple'];
builder.buildModule(readonlyTuple);
const readonlyArray: readonly PropertyKey[] = ['typed-array'];
builder.buildModule(readonlyArray);
builder.buildModule(['labeled'] as const, { label: 'legacy' });
builder.buildModule({ exportedServiceKeys: ['nested'] as const, nested: builder.register({ nested: () => 1 }) });
declare const anyShape: any;
builder.buildModule(anyShape);
declare const unknownShape: unknown;
builder.buildModule(unknownShape);
declare const neverShape: never;
builder.buildModule(neverShape);
declare const unresolvedShape: {};
builder.buildModule(unresolvedShape);
declare const mixedShape: readonly ['mixed'] | { exportedServiceKeys: readonly ['mixed'] };
builder.buildModule(mixedShape);
declare const intersectionShape: readonly ['both'] & { exportedServiceKeys: readonly ['both'] };
builder.buildModule(intersectionShape);
`;

const expected = `const inlineBag = builder.buildModule({ exportedServiceKeys: ['inline'] as const });
const inferredBag = { exportedServiceKeys: ['inferred'] as const };
builder.buildModule(inferredBag);
type ModuleBag = { exportedServiceKeys: readonly ['typed'] };
const typedBag: ModuleBag = { exportedServiceKeys: ['typed'] };
builder.buildModule(typedBag);
builder.buildModule({ exportedServiceKeys: ['inline-tuple'] as const });
const namedTuple = ['named-tuple'] as const;
builder.buildModule({ exportedServiceKeys: namedTuple });
const readonlyTuple: readonly ['typed-tuple'] = ['typed-tuple'];
builder.buildModule({ exportedServiceKeys: readonlyTuple });
const readonlyArray: readonly PropertyKey[] = ['typed-array'];
builder.buildModule({ exportedServiceKeys: readonlyArray });
builder.buildModule({ exportedServiceKeys: ['labeled'] as const, moduleLabel: 'legacy' });
builder.buildModule({ exportedServiceKeys: ['nested'] as const, nested: builder.withServices({ nested: () => 1 }) });
declare const anyShape: any;
builder.buildModule(anyShape);
declare const unknownShape: unknown;
builder.buildModule(unknownShape);
declare const neverShape: never;
builder.buildModule(neverShape);
declare const unresolvedShape: {};
builder.buildModule(unresolvedShape);
declare const mixedShape: readonly ['mixed'] | { exportedServiceKeys: readonly ['mixed'] };
builder.buildModule(mixedShape);
declare const intersectionShape: readonly ['both'] & { exportedServiceKeys: readonly ['both'] };
builder.buildModule(intersectionShape);
`;

const expectedManual = [17, 19, 21, 23, 25, 27].map(line => ({
  line,
  reason: 'the argument of buildModule could be either its positional value or an existing options bag; migrate this call by hand',
}));

function rewrite(text) {
  writeFileSync(source, text);
  const ts = compiler.ts;
  const program = ts.createProgram([source, library], {
    strict: true, noEmit: true, skipLibCheck: true, types: [],
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext,
  });
  assert.deepEqual(ts.getPreEmitDiagnostics(program).map(diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')), []);
  return runCodemod({ typescript: ts, root, program, only: ['input.ts'], libraryRoots: ['lib'] });
}

test('same-name bag migration distinguishes old, completed and ambiguous argument shapes', () => {
  const first = rewrite(input);
  assert.equal(first.files[0]?.text, expected);
  assert.deepEqual(first.manual.map(({ line, reason }) => ({ line, reason })), expectedManual);

  const second = rewrite(expected);
  assert.equal(second.files.length, 0);
  assert.equal(second.rewrites, 0);
  assert.deepEqual(second.manual.map(({ line, reason }) => ({ line, reason })), expectedManual);
  assert.equal(readFileSync(source, 'utf8'), expected);
});
