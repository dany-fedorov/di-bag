// Runs the codemod over standalone guide and README TypeScript blocks, then restores changed blocks between their fences.
// Usage: node scripts/migrate-doc-snippets.mjs [--write] [--root dir] [--command "codemod command"] [page.md ...]
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { isStandaloneProgram, parseMarkdown } from '../tools/docs/lib/agent-docs.mjs';

const args = process.argv.slice(2);
const take = name => { const index = args.indexOf(name); return index === -1 ? undefined : args.splice(index, 2)[1]; };
const root = resolve(take('--root') ?? '.');
const command = (take('--command') ?? 'node tools/codemod/cli.mjs').split(' ');
const write = args.includes('--write') && args.splice(args.indexOf('--write'), 1).length > 0;
const pages = (args.length ? args : [...(existsSync(join(root, 'README.md')) ? ['README.md'] : []),
  ...(existsSync(join(root, 'docs/guides')) ? readdirSync(join(root, 'docs/guides')).filter(file => file.endsWith('.md')).sort().map(file => `docs/guides/${file}`) : [])])
  .filter(page => page !== 'docs/guides/migrating-to-0.5.md');

const work = join(root, 'tools/codemod/.doc-snippets');
const vendored = join(root, 'tools/codemod/test/fixtures/node_modules/di-bag');
rmSync(work, { recursive: true, force: true });
mkdirSync(join(work, 'node_modules'), { recursive: true });
if (existsSync(vendored)) cpSync(vendored, join(work, 'node_modules/di-bag'), { recursive: true });

const found = [];
for (const page of pages) {
  const { blocks } = parseMarkdown(readFileSync(join(root, page), 'utf8'));
  for (const block of blocks) {
    if (block.lang !== 'ts' || !isStandaloneProgram(block.code)) continue;
    const file = join(work, 'snippets', page.replaceAll('/', '__').replace(/\.md$/, ''), `block-${block.line}.ts`);
    mkdirSync(join(file, '..'), { recursive: true });
    writeFileSync(file, block.code);
    found.push({ page, line: block.line, file, before: block.code });
  }
}
writeFileSync(join(work, 'package.json'), '{ "name": "doc-snippets", "private": true, "type": "module" }\n');
writeFileSync(join(work, 'tsconfig.json'), JSON.stringify({ compilerOptions: { strict: true, noEmit: true, module: 'NodeNext', moduleResolution: 'NodeNext', target: 'es2022', skipLibCheck: true, types: [] }, include: ['snippets'] }, null, 2) + '\n');
console.log(`${found.length} standalone blocks from ${new Set(found.map(item => item.page)).size} pages`);
if (found.length === 0) {
  console.log(`0 of 0 blocks ${write ? 'rewritten' : 'would change'}`);
  process.exit(0);
}

const report = join(work, 'report.json');
const run = spawnSync(command[0], [...command.slice(1), '--project', join(work, 'tsconfig.json'), '--write', '--report', report], { cwd: root, encoding: 'utf8' });
if (run.status !== 0) { console.error(`the codemod failed:\n${run.stdout}${run.stderr}`); process.exit(1); }

let changed = 0;
for (const page of new Set(found.map(item => item.page))) {
  const lines = readFileSync(join(root, page), 'utf8').split('\n');
  for (const item of found.filter(candidate => candidate.page === page).sort((a, b) => b.line - a.line)) {
    const after = readFileSync(item.file, 'utf8');
    if (after === item.before) continue;
    changed += 1;
    console.log(`${write ? 'rewrote' : 'would rewrite'} ${page}:${item.line}`);
    lines.splice(item.line, item.before.split('\n').length - 1, ...after.replace(/\n$/, '').split('\n'));
  }
  if (write) writeFileSync(join(root, page), lines.join('\n'));
}
console.log(`${changed} of ${found.length} blocks ${write ? 'rewritten' : 'would change'}`);
if (existsSync(report)) {
  const manual = JSON.parse(readFileSync(report, 'utf8')).manual ?? [];
  for (const item of manual) console.log(`manual: ${item.file}:${item.line} ${item.reason}`);
}
