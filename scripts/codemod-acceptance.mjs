// Acceptance for di-bag-codemod: the examples as they were at the v0.4.0 tag are migrated by the codemod alone and must
// then type-check and run against the 0.5.0 build, with no hand edits.
// Usage, from the repository root, after `npm run build`: node scripts/codemod-acceptance.mjs [--prepare-only] [--keep]
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const TAG = 'v0.4.0';
// Inside the repository on purpose: module resolution walks up to the root node_modules for react and the type packages,
// while the workspace's own node_modules/di-bag decides which di-bag the examples see.
const work = 'tools/codemod/.acceptance';
const library = join(work, 'node_modules/di-bag');
const vendored = 'tools/codemod/test/fixtures/node_modules/di-bag';
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const step = (title, command, args, options = {}) => {
  const result = spawnSync(command, args, { encoding: 'utf8', ...options });
  if (result.status !== 0) { console.error(`FAILED: ${title}\n${result.stdout}${result.stderr}`); process.exit(1); }
  console.log(`ok: ${title}`);
  return result.stdout;
};

rmSync(work, { recursive: true, force: true });
const files = git('ls-tree', '-r', '--name-only', TAG, 'examples/').split('\n').filter(name => /\.tsx?$/.test(name));
if (files.length === 0) { console.error(`no examples at ${TAG}: is the tag fetched?`); process.exit(1); }
for (const file of files) {
  const target = join(work, file);
  mkdirSync(dirname(target), { recursive: true });
  // At the tag the examples import the source tree. A user's project imports the package, so rewrite exactly that specifier.
  const depth = file.split('/').length - 1;
  const source = `'${'../'.repeat(depth)}src'`;
  const text = git('show', `${TAG}:${file}`);
  writeFileSync(target, text.replaceAll(source, "'di-bag'").replaceAll(`'${'../'.repeat(depth)}src/node'`, "'di-bag/node'"));
}
const compilerOptions = { ...JSON.parse(git('show', `${TAG}:tsconfig.json`)).compilerOptions, rootDir: '.' };
writeFileSync(join(work, 'tsconfig.json'), JSON.stringify({ compilerOptions, include: ['examples'] }, null, 2) + '\n');
writeFileSync(join(work, 'package.json'), JSON.stringify({ name: 'di-bag-codemod-acceptance', private: true }, null, 2) + '\n');
const leftovers = files.filter(file => /from '(\.\.\/)+src/.test(readFileSync(join(work, file), 'utf8')));
if (leftovers.length) { console.error(`these examples still import the source tree: ${leftovers.join(', ')}`); process.exit(1); }
console.log(`ok: ${files.length} examples from ${TAG} in ${work}`);
if (process.argv.includes('--prepare-only')) process.exit(0);

// 1. The project as a 0.4.0 user has it: the published 0.4.0 declarations, which phase 1 vendored for the codemod's own tests.
if (!existsSync(join(vendored, 'package.json'))) { console.error(`${vendored} is missing: phase 1 vendors it`); process.exit(1); }
cpSync(vendored, library, { recursive: true });
step('the 0.4.0 examples type-check against 0.4.0 before the codemod runs', 'node_modules/.bin/tsc6', ['-p', join(work, 'tsconfig.json')]);

// 2. The codemod, exactly as the README tells a user to run it: before upgrading, with no library root.
const report = join(work, 'codemod-report.json');
step('the codemod rewrites the project', 'node', ['tools/codemod/cli.mjs', '--project', join(work, 'tsconfig.json'), '--write', '--report', report]);
const manual = JSON.parse(readFileSync(report, 'utf8')).manual ?? [];
if (manual.length) { console.error(`the codemod left ${manual.length} manual item(s); acceptance allows none:\n${manual.map(item => `  ${item.file}:${item.line} ${item.reason}`).join('\n')}`); process.exit(1); }
console.log('ok: no manual items');

// 3. The upgrade: the package this checkout builds.
if (!existsSync('dist/index.d.ts')) { console.error('dist is missing: run npm run build first'); process.exit(1); }
rmSync(library, { recursive: true, force: true });
mkdirSync(library, { recursive: true });
cpSync('dist', join(library, 'dist'), { recursive: true });
cpSync('package.json', join(library, 'package.json'));
step('the migrated examples type-check against the 0.5.0 build', 'node_modules/.bin/tsc6', ['-p', join(work, 'tsconfig.json')]);

// 4. They still do what they did. The React examples need a browser and are covered by check:react-browser.
for (const file of files.filter(name => !name.startsWith('examples/react/'))) step(`bun run ${file}`, 'bun', ['run', join(work, file)]);
if (!process.argv.includes('--keep')) rmSync(work, { recursive: true, force: true });
console.log('codemod acceptance passed');
