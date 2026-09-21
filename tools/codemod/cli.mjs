#!/usr/bin/env node
// tools/codemod/cli.mjs
import { existsSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { loadTypeScript, runCodemod } from './lib/codemod.mjs';

const usage = 'usage: di-bag-codemod [--project tsconfig.json | file.ts ...] [--library-root dir]... [--extra-files glob]... [--map rename-map.json] [--write] [--report report.json]';
const args = process.argv.slice(2);
const files = [];
const extraFiles = [];
const libraryRoots = [];
let project, mapFile, report, write = false;
const value = index => {
  if (args[index] === undefined || args[index].startsWith('-')) fail(`${args[index - 1]} needs a value`);
  return args[index];
};
for (let index = 0; index < args.length; index++) {
  const argument = args[index];
  if (argument === '--project') project = value(++index);
  else if (argument === '--library-root') libraryRoots.push(value(++index));
  else if (argument === '--extra-files') extraFiles.push(value(++index));
  else if (argument === '--map') mapFile = value(++index);
  else if (argument === '--report') report = value(++index);
  else if (argument === '--write') write = true;
  else if (argument === '--help' || argument === '-h') { console.log(usage); process.exit(0); }
  else if (argument.startsWith('-')) fail(`unknown option ${argument}`);
  else files.push(argument);
}
if (!project && files.length === 0) {
  if (!existsSync('tsconfig.json')) fail('no tsconfig.json in the current directory; pass --project or files');
  project = 'tsconfig.json';
}

function fail(message) {
  console.error(`di-bag-codemod: ${message}\n${usage}`);
  process.exit(2);
}

const root = process.cwd();
const compiler = loadTypeScript(project ? dirname(resolve(root, project)) : root);
let result;
try {
  result = runCodemod({ typescript: compiler.ts, root, project, files, extraFiles, libraryRoots, write, ...(mapFile ? { mapFile: resolve(root, mapFile) } : {}) });
} catch (error) {
  fail(error.message);
}
if (report) writeFileSync(report, JSON.stringify({ version: 1, written: write, files: result.files.map(({ file, rewrites }) => ({ file, rewrites })), manual: result.manual }, null, 2) + '\n');
for (const file of result.files) console.log(`${write ? 'rewrote' : 'would rewrite'} ${file.file}: ${file.rewrites} rewrites`);
for (const item of result.manual) console.log(`manual ${item.file}:${item.line}:${item.column} ${item.reason}${item.text ? `\n       ${item.text}` : ''}`);
console.log(`${result.files.length} files, ${result.rewrites} rewrites, ${result.manual.length} manual items${write ? '' : ' (dry run; pass --write to apply)'} (TypeScript ${compiler.version}, ${compiler.source})`);
