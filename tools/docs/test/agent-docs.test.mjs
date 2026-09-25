import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import {
  checkBudgets, checkErrorCoverage, checkLayoutBlock, checkMessageUrlsInBuild, checkMessageUrlsInSources, checkSnippets,
  collectSnippets, jsDocExamples, parseMarkdown, readMarkers, slugify,
} from '../lib/agent-docs.mjs';
import { sitePages } from '../lib/markdown.mjs';

const typeRoots = [resolve(dirname(fileURLToPath(import.meta.url)), '../node_modules/@types')];

function fixture(files) {
  const root = mkdtempSync(join(tmpdir(), 'di-bag-agent-docs-'));
  for (const [file, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), content);
  }
  return root;
}

const fence = (code, lang = 'ts') => `\`\`\`${lang}\n${code}\n\`\`\`\n`;
const layout = fence('src/features/x/\n  module.ts', 'text');

test('headings use explicit ids or the site slug, and fences hide heading-like lines', () => {
  assert.equal(slugify('Recommended module layout'), 'recommended-module-layout');
  assert.equal(slugify('Attach cleanup with withDisposal()'), 'attach-cleanup-with-withdisposal');
  const { headings, blocks } = parseMarkdown(`# Page\n## DI_BAG_DEPENDENCY_CYCLE {#di-bag-dependency-cycle}\n${fence('# not a heading')}## Plain title\n`);
  assert.deepEqual(headings.map(heading => [heading.id, heading.explicit]), [['page', false], ['di-bag-dependency-cycle', true], ['plain-title', false]]);
  assert.equal(blocks[0].heading, 'di-bag-dependency-cycle');
});

test('markers read only leading comment lines', () => {
  assert.deepEqual(readMarkers('// src/app.ts\n// continues: setup\nconst x = 1;\n// expect-error: later'), { file: 'src/app.ts', continues: 'setup' });
  assert.deepEqual(readMarkers('// expect-error: is missing\nx;'), { expectError: 'is missing' });
  assert.deepEqual(readMarkers('// an ordinary comment\n'), {});
  assert.throws(() => readMarkers('// a.ts\n// b.ts\n'), /repeated file/);
});

test('JSDoc examples keep their fences and gain the facade import when they have none', () => {
  const examples = jsDocExamples('/**\n * Summary.\n * @example\n * ```ts\n * const a = DiBag.createBuilder();\n * ```\n * @returns x\n */\n');
  assert.equal(examples.length, 1);
  assert.equal(examples[0].code, "import { DiBag } from 'di-bag';\nconst a = DiBag.createBuilder();\n");
  assert.equal(examples[0].line, 4);
});

test('snippets type-check together against a consumer package, honoring continues, files, and expect-error', () => {
  const root = fixture({
    'AGENTS.md': `# Agents\n## Setup\n${fence("import { make } from 'di-bag';\nexport const value = make(1);")}`,
    'docs/agent/recipes.md': [
      '# Recipes',
      '## One {#one}',
      fence("// src/contract.ts\nexport type Clock = { now(): number };"),
      fence("// src/app.ts\nimport type { Clock } from './contract.js';\nimport { make } from 'di-bag';\nexport const clock: Clock = { now: () => make(2) };"),
      '## Two {#two}',
      fence("// continues: one\nconst doubled: number = clock.now() * 2;"),
      fence("// expect-error: not assignable to type 'string'\nimport { make } from 'di-bag';\nconst text: string = make(3);"),
    ].join('\n'),
    'src/api.ts': '/**\n * @example\n * ```ts\n * const n: string = DiBag.make(4);\n * ```\n */\nexport {};\n',
    'node_modules/di-bag/package.json': '{ "name": "di-bag", "exports": { ".": { "types": "./index.d.ts" } } }',
    'node_modules/di-bag/index.d.ts': 'export declare function make(value: number): number;\nexport declare const DiBag: { make(value: number): number };',
  });
  try {
    // The src example gains the facade import and fails only on its own wrong annotation.
    const { snippets, errors } = collectSnippets(root);
    assert.deepEqual(errors, []);
    assert.equal(snippets.length, 6);
    const failures = checkSnippets(snippets, root, typeRoots);
    assert.equal(failures.length, 1, failures.join('\n'));
    assert.match(failures[0], /^src\/api\.ts:3: line 2: TS2322/);

    writeFileSync(join(root, 'src/api.ts'), 'export {};\n');
    assert.deepEqual(checkSnippets(collectSnippets(root).snippets, root, typeRoots), []);

    writeFileSync(join(root, 'docs/agent/recipes.md'), `# R\n## A {#a}\n${fence("// expect-error: nothing like this\nimport { make } from 'di-bag';\nmake(1);")}${fence('// continues: missing\n')}`);
    const collected = collectSnippets(root);
    assert.match(collected.errors[0], /continues unknown heading #missing/);
    assert.match(checkSnippets(collected.snippets, root, typeRoots)[0], /expected a diagnostic containing "nothing like this"; got none/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('budgets, layout identity, and error coverage report drift', () => {
  const families = ['missing-service', 'unsatisfied-consumer', 'singleton-captures-scoped', 'unknown-key', 'structural-thenable', 'wrong-shape', 'wrong-override'];
  const errorsPage = codes => `# Errors {#errors}\n${codes.map(code => `## ${code} {#${code.toLowerCase().replace(/_/g, '-')}}\n`).join('')}${families.map(id => `## Family {#${id}}\n`).join('')}`;
  const root = fixture({
    'AGENTS.md': `# A\n${layout}`,
    'docs/guides/examples-modularity.md': `# M\n## Recommended module layout\n${layout}`,
    'docs/agent/errors.md': errorsPage(['DI_BAG_DEPENDENCY_CYCLE']),
    'src/a.ts': "throw libraryError('DI_BAG_DEPENDENCY_CYCLE', 'cycle');",
  });
  try {
    assert.deepEqual([...checkBudgets(root), ...checkLayoutBlock(root), ...checkErrorCoverage(root)], []);
    writeFileSync(join(root, 'AGENTS.md'), `# A\n${fence('src/features/x/\n module.ts', 'text')}${'\n'.repeat(150)}`);
    assert.match(checkBudgets(root)[0], /AGENTS.md has 15\d lines; the budget is 150/);
    assert.match(checkLayoutBlock(root)[0], /differs/);
    writeFileSync(join(root, 'docs/agent/api-card.md'), 'x\n'.repeat(401));
    assert.match(checkBudgets(root)[1], /api-card.md has 401 lines/);
    writeFileSync(join(root, 'docs/agent/recipes.md'), `# Recipes\n## Short {#short}\n${'x\n'.repeat(57)}\n## Long {#long}\n${'x\n'.repeat(59)}`);
    assert.deepEqual(checkBudgets(root).slice(2), ['docs/agent/recipes.md#long has 60 lines; recipes stay under 60']);
    writeFileSync(join(root, 'src/b.ts'), "libraryError('DI_BAG_NEW', 'new');");
    writeFileSync(join(root, 'docs/agent/errors.md'), `${errorsPage(['DI_BAG_DEPENDENCY_CYCLE', 'DI_BAG_GONE'])}## DI_BAG_ODD {#odd}\n## Untagged\n`);
    assert.deepEqual(checkErrorCoverage(root), [
      'docs/agent/errors.md:11: DI_BAG_ODD must use {#di-bag-odd}',
      'docs/agent/errors.md:12: heading "Untagged" needs an explicit {#id}',
      'docs/agent/errors.md: no section for DI_BAG_NEW',
      'docs/agent/errors.md: section DI_BAG_GONE is not raised in src',
      'docs/agent/errors.md: section DI_BAG_ODD is not raised in src',
    ]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('message URLs in src resolve to a page and anchor, in sources and in the build', () => {
  const root = fixture({
    'README.md': '# Intro\n',
    'docs/agent/errors.md': '# Errors\n## DI_BAG_DEPENDENCY_CYCLE {#di-bag-dependency-cycle}\n',
    'src/a.ts': "const see = 'see https://dany-fedorov.github.io/di-bag/agent/errors.html#di-bag-dependency-cycle';",
    'dist/agent/errors.html': '<h2 id="di-bag-dependency-cycle">DI_BAG_DEPENDENCY_CYCLE</h2>',
  });
  try {
    assert.deepEqual(checkMessageUrlsInSources(root, sitePages(root)), []);
    assert.deepEqual(checkMessageUrlsInBuild(root, join(root, 'dist')), []);
    writeFileSync(join(root, 'src/b.ts'), "`; see https://dany-fedorov.github.io/di-bag/agent/errors#di-bag-gone`; 'https://dany-fedorov.github.io/di-bag/agent/nope.html'");
    assert.deepEqual(checkMessageUrlsInSources(root, sitePages(root)), [
      'src/b.ts: https://dany-fedorov.github.io/di-bag/agent/errors#di-bag-gone names a missing anchor in docs/agent/errors.md',
      'src/b.ts: https://dany-fedorov.github.io/di-bag/agent/nope.html names no site page',
    ]);
    assert.equal(checkMessageUrlsInBuild(root, join(root, 'dist')).length, 2);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('type-level message URLs expand ErrorsPage with each SeeErrors section', () => {
  const root = fixture({
    'README.md': '# Intro\n',
    'docs/agent/errors.md': '# Errors\n## Missing service {#missing-service}\n',
    'src/types.ts': "export type ErrorsPage = 'https://dany-fedorov.github.io/di-bag/agent/errors.html';\ntype A = `missing${SeeErrors<'missing-service'>}`;\ntype B = `gone${SeeErrors<'gone'>}`;",
    'dist/agent/errors.html': '<h3 id="missing-service">Missing service</h3>',
  });
  try {
    assert.deepEqual(checkMessageUrlsInSources(root, sitePages(root)), [
      'src/types.ts: https://dany-fedorov.github.io/di-bag/agent/errors.html#gone names a missing anchor in docs/agent/errors.md',
    ]);
    assert.deepEqual(checkMessageUrlsInBuild(root, join(root, 'dist')), [
      'src/types.ts: https://dany-fedorov.github.io/di-bag/agent/errors.html#gone has no rendered anchor',
    ]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
