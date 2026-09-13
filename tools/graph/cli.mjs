#!/usr/bin/env node
// tools/graph/cli.mjs
import { existsSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { extractDependencyGraph, loadTypeScript } from './lib/extract.mjs';

const usage = 'usage: di-bag-graph [--project tsconfig.json | file.ts ...] [--out graph.json] [--check]';
const args = process.argv.slice(2);
const files = [];
let project, out, check = false;
for (let index = 0; index < args.length; index++) {
  const argument = args[index];
  if (argument === '--project') project = args[++index];
  else if (argument === '--out') out = args[++index];
  else if (argument === '--check') check = true;
  else if (argument === '--help' || argument === '-h') { console.log(usage); process.exit(0); }
  else if (argument.startsWith('-')) fail(`unknown option ${argument}`);
  else files.push(argument);
}
if (!project && files.length === 0) {
  if (!existsSync('tsconfig.json')) fail('no tsconfig.json in the current directory; pass --project or files');
  project = 'tsconfig.json';
}

function fail(message) {
  console.error(`di-bag-graph: ${message}\n${usage}`);
  process.exit(2);
}

const root = process.cwd();
const compiler = loadTypeScript(project ? dirname(resolve(root, project)) : root);
let graph;
try {
  graph = extractDependencyGraph({ project, files, root, typescript: compiler.ts });
} catch (error) {
  fail(error.message);
}
if (out) writeFileSync(out, JSON.stringify(graph, null, 2) + '\n');
else if (!check) console.log(JSON.stringify(graph, null, 2));
const nodes = graph.units.reduce((total, unit) => total + unit.nodes.length, 0);
console.log(`${graph.units.length} units, ${nodes} nodes, ${graph.issues.length} issues${out ? ` -> ${out}` : ''} (TypeScript ${compiler.version}, ${compiler.source})`);
for (const issue of graph.issues) {
  console.log(issue.kind === 'cycle'
    ? `cycle in ${issue.unit}: ${issue.path.join(' -> ')}`
    : `unresolved in ${issue.unit}: ${issue.consumer} needs ${issue.dependency}`);
}
process.exit(check && graph.issues.length > 0 ? 1 : 0);
