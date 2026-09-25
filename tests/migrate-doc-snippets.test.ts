import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { closeSync, cpSync, mkdirSync, mkdtempSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { checkSnippets, collectSnippets, writeDeclarationPackage } from '../tools/docs/lib/agent-docs.mjs';

const repo = resolve(__dirname, '..');
const script = resolve(repo, 'scripts/migrate-doc-snippets.mjs');
const fake = resolve(__dirname, 'fixtures/doc-snippets/fake-codemod.mjs');
const codemod = resolve(repo, 'tools/codemod/cli.mjs');
const map = resolve(repo, 'tools/codemod/rename-map.json');
const fence = (code: string, lang = 'ts') => '```' + lang + '\n' + code + '\n```';
const standalone = "import { DiBag } from 'di-bag';\nconst app = DiBag.createBuilder().register({ a: () => 1 }).build();";
const page = ['# Guide', '', 'First.', '', fence(standalone), '', 'A fragment stays as it is:', '', fence('builder.register({ b: () => 2 });'), '', 'Second.', '', fence(standalone.replace('a:', 'c:')), '', 'End.', ''].join('\n');

function captured(command: string, args: string[], cwd: string) {
  // Bun 1.4.0 drops Node child output in pipes; file descriptors preserve it.
  const capture = mkdtempSync(join(tmpdir(), 'doc-snippets-output-'));
  const output = openSync(join(capture, 'stdout'), 'w+');
  const errors = openSync(join(capture, 'stderr'), 'w+');
  try {
    const result = spawnSync(command, args, { cwd, stdio: ['ignore', output, errors] });
    return { status: result.status, stdout: readFileSync(join(capture, 'stdout'), 'utf8'), stderr: readFileSync(join(capture, 'stderr'), 'utf8') };
  } finally {
    closeSync(output);
    closeSync(errors);
    rmSync(capture, { recursive: true, force: true });
  }
}

function workspace(command = `node ${fake}`) {
  const root = mkdtempSync(join(tmpdir(), 'doc-snippets-'));
  mkdirSync(join(root, 'docs/guides'), { recursive: true });
  mkdirSync(join(root, 'src'));
  writeFileSync(join(root, 'docs/guides/guide.md'), page);
  return { root, run: (...flags: string[]) => captured('node', [script, '--root', root, '--command', command, ...flags], root) };
}

test('a dry run reports and changes nothing', () => {
  const { root, run } = workspace();
  try {
    const result = run();
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('2 standalone blocks from 1 pages');
    expect(result.stdout).toContain('would rewrite docs/guides/guide.md:5');
    expect(result.stdout).toContain('would rewrite docs/guides/guide.md:18');
    expect(result.stdout).toContain('manual: snippets/x.ts:1 a reason a person must read');
    expect(readFileSync(join(root, 'docs/guides/guide.md'), 'utf8')).toBe(page);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('--write puts each migrated block back where it came from, even when a block above it grew', () => {
  const { root, run } = workspace();
  try {
    expect(run('--write').status).toBe(0);
    const migrated = "import { DiBag } from 'di-bag';\nconst app = DiBag.createBuilder().withServices({ a: () => 1 })\n  .buildContainer();";
    expect(readFileSync(join(root, 'docs/guides/guide.md'), 'utf8')).toBe(page.replace(standalone, migrated).replace(standalone.replace('a:', 'c:'), migrated.replace('a:', 'c:')));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('the historical migration guide is never sent to the codemod, even when named', () => {
  const { root, run } = workspace();
  const historical = ['# Old API', '', fence(standalone), ''].join('\n');
  writeFileSync(join(root, 'docs/guides/migrating-to-0.5.md'), historical);
  try {
    const defaultRun = run();
    expect(defaultRun.status).toBe(0);
    expect(defaultRun.stdout).toContain('2 standalone blocks from 1 pages');
    for (const spelling of ['docs/guides/migrating-to-0.5.md', './docs/guides/migrating-to-0.5.md', join(root, 'docs/guides/migrating-to-0.5.md')]) {
      const explicitRun = run('--write', spelling);
      expect(explicitRun.status).toBe(0);
      expect(explicitRun.stdout).toContain('0 standalone blocks from 0 pages');
      expect(readFileSync(join(root, 'docs/guides/migrating-to-0.5.md'), 'utf8')).toBe(historical);
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('the shipped codemod keeps a current module bag while migrating an independent legacy call, and the result compiles', () => {
  const { root, run } = workspace(`node ${codemod} --map ${map}`);
  const mixed = [
    "import { DiBag } from 'di-bag';",
    "const current = DiBag.createBuilder().withServices({ now: () => 1 }).buildModule({ exportedServiceKeys: ['now'] });",
    "const legacy = DiBag.createBuilder().register({ later: () => 2 }).buildModule(['later']);",
  ].join('\n');
  const document = ['# Mixed', '', fence(mixed), '', 'Prose after the fence.', ''].join('\n');
  writeFileSync(join(root, 'docs/guides/guide.md'), document);
  cpSync(resolve(repo, 'tools/codemod/test/fixtures/node_modules/di-bag'), join(root, 'tools/codemod/test/fixtures/node_modules/di-bag'), { recursive: true });
  try {
    const result = run('--write');
    expect(result.status).toBe(0);
    const rewritten = readFileSync(join(root, 'docs/guides/guide.md'), 'utf8');
    expect(rewritten).toContain("buildModule({ exportedServiceKeys: ['now'] })");
    expect(rewritten).toContain("withServices({ later: () => 2 }).buildModule({ exportedServiceKeys: ['later'] })");
    expect(rewritten).not.toContain('exportedServiceKeys: { exportedServiceKeys:');
    expect(rewritten).toContain('Prose after the fence.');
    const checkRoot = mkdtempSync(join(tmpdir(), 'doc-snippets-compile-'));
    try {
      const packageDirectory = join(checkRoot, 'node_modules/di-bag');
      mkdirSync(packageDirectory, { recursive: true });
      writeDeclarationPackage(repo, packageDirectory);
      const { snippets, errors } = collectSnippets(root);
      expect(errors).toEqual([]);
      expect(checkSnippets(snippets, checkRoot, [resolve(repo, 'node_modules/@types')])).toEqual([]);
    } finally { rmSync(checkRoot, { recursive: true, force: true }); }
  } finally { rmSync(root, { recursive: true, force: true }); }
});
