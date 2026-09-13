import { existsSync, mkdirSync, readFileSync, rmSync, watch, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { checkMessageUrlsInBuild } from './lib/agent-docs.mjs';
import { listFiles, rewriteMarkdownLinks, sitePages } from './lib/markdown.mjs';
import { verifyBuiltSite } from './lib/site-check.mjs';

const directory = dirname(fileURLToPath(import.meta.url));
const root = resolve(directory, '../..');
const site = join(directory, 'site');
const command = process.argv[2] ?? 'build';
if (!['build', 'dev', 'preview', 'check', 'prepare'].includes(command)) throw new Error('Usage: node site.mjs build|dev|preview|check|prepare');

function writeChanged(path, content) {
  if (existsSync(path) && readFileSync(path).equals(Buffer.from(content))) return;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function prepare() {
  const reference = join(root, 'docs/reference');
  if (!existsSync(join(reference, 'index.md'))) throw new Error('Missing generated reference. Run npm run docs:generate first.');
  const pages = sitePages(root);
  for (const [source, route] of pages) {
    const content = rewriteMarkdownLinks(readFileSync(join(root, source), 'utf8'), source, pages, root);
    const settings = source.startsWith('docs/reference/') ? '---\neditLink: false\n---\n\n' : '';
    writeChanged(join(site, route), settings + content);
  }
  const routes = new Set(pages.values());
  for (const file of listFiles(site).filter(file => file.endsWith('.md') && !file.startsWith('.vitepress/'))) {
    if (!routes.has(file)) rmSync(join(site, file));
  }
  writeChanged(join(site, 'reference/typedoc-sidebar.json'), readFileSync(join(reference, 'typedoc-sidebar.json')));
  writeChanged(join(site, '.vitepress/config.mjs'), readFileSync(join(directory, 'vitepress.config.mjs')));
  for (const file of listFiles(join(directory, 'theme'))) {
    writeChanged(join(site, '.vitepress/theme', file), readFileSync(join(directory, 'theme', file)));
  }
  return pages.size;
}

if (command !== 'preview') console.log(`Prepared ${prepare()} Markdown pages; repository-only links point to GitHub.`);
if (command === 'prepare' || command === 'check') process.exit(0);

const child = spawn(process.execPath, [join(directory, 'node_modules/vitepress/bin/vitepress.js'), command, site, ...process.argv.slice(3)], {
  cwd: directory, stdio: 'inherit',
});
const forwardInterrupt = () => child.kill('SIGINT');
const forwardTerminate = () => child.kill('SIGTERM');
process.once('SIGINT', forwardInterrupt);
process.once('SIGTERM', forwardTerminate);
const watchers = [];
let timer;
if (command === 'dev') {
  const changed = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      try { prepare(); } catch (error) { console.error(error.message); }
    }, 80);
  };
  // Watch stable parents so atomic saves and a regenerated reference keep working.
  for (const [path, recursive, accepts] of [
    ['.', false, name => name === 'README.md'],
    ['docs', true, name => /^(?:guides|agent|reference)(?:\/|$)/.test(name)],
    ['tools/docs', false, name => name === 'vitepress.config.mjs'],
    ['tools/docs/theme', true, () => true],
  ]) {
    watchers.push(watch(join(root, path), { recursive }, (_event, name) => {
      if (accepts(String(name ?? ''))) changed();
    }));
  }
}
const exitCode = await new Promise((resolve, reject) => {
  child.once('error', reject);
  child.once('exit', (code, signal) => resolve(code ?? (signal ? 1 : 0)));
});
process.off('SIGINT', forwardInterrupt);
process.off('SIGTERM', forwardTerminate);
clearTimeout(timer);
for (const watcher of watchers) watcher.close();
if (command === 'build' && exitCode === 0) {
  const report = verifyBuiltSite(join(site, '.vitepress/dist'));
  const messageErrors = checkMessageUrlsInBuild(root, join(site, '.vitepress/dist'));
  if (messageErrors.length) throw new Error(`Message URLs do not resolve in the built site:\n${messageErrors.join('\n')}`);
  console.log(`Verified ${report.pages} rendered pages and ${report.links} internal links, anchors, assets, and message URLs.`);
}
process.exitCode = exitCode;
