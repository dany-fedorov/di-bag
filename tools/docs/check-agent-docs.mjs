import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  checkBudgets, checkErrorCoverage, checkLayoutBlock, checkMessageUrlsInSources, checkSnippets, collectSnippets, writeDeclarationPackage,
} from './lib/agent-docs.mjs';
import { sitePages } from './lib/markdown.mjs';

const directory = dirname(fileURLToPath(import.meta.url));
const root = resolve(directory, '../..');
// The workspace sits outside the repository so resolution sees only the emitted package.
const workspace = mkdtempSync(join(tmpdir(), 'di-bag-snippets-'));

try {
  const errors = [...checkBudgets(root), ...checkLayoutBlock(root), ...checkErrorCoverage(root), ...checkMessageUrlsInSources(root, sitePages(root))];
  const packageDirectory = join(workspace, 'node_modules/di-bag');
  mkdirSync(packageDirectory, { recursive: true });
  writeDeclarationPackage(root, packageDirectory);
  const { snippets, errors: collectionErrors } = collectSnippets(root);
  errors.push(...collectionErrors, ...checkSnippets(snippets, workspace, [join(directory, 'node_modules/@types')]));
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exitCode = 1;
  } else {
    console.log(`Agent docs are consistent: ${snippets.length} snippets type-check against the emitted declarations.`);
  }
} finally {
  rmSync(workspace, { recursive: true, force: true });
}
