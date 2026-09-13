#!/usr/bin/env node
// tools/graph/cli.mjs
import { writeFileSync } from 'node:fs';
import { extractDependencyGraph } from './lib/extract.mjs';

const args = process.argv.slice(2);
const files = [];
let project, out, check = false;
for (let index = 0; index < args.length; index++) {
  const argument = args[index];
  if (argument === '--project') project = args[++index];
  else if (argument === '--out') out = args[++index];
  else if (argument === '--check') check = true;
  else if (argument === '--help' || argument === '-h') { usage(); process.exit(0); }
  else files.push(argument);
}
if (!project && files.length === 0) { usage(); process.exit(2); }

function usage() {
  console.log('usage: di-bag-graph (--project tsconfig.json | file.ts ...) [--out graph.json] [--check]');
}

const graph = extractDependencyGraph({ project, files, root: process.cwd() });
if (out) writeFileSync(out, JSON.stringify(graph, null, 2) + '\n');
else if (!check) console.log(JSON.stringify(graph, null, 2));
const nodes = graph.units.reduce((total, unit) => total + unit.nodes.length, 0);
console.log(`${graph.units.length} units, ${nodes} nodes, ${graph.issues.length} issues${out ? ` -> ${out}` : ''}`);
for (const issue of graph.issues) {
  console.log(issue.kind === 'cycle'
    ? `cycle in ${issue.unit}: ${issue.path.join(' -> ')}`
    : `unresolved in ${issue.unit}: ${issue.consumer} needs ${issue.dependency}`);
}
process.exit(check && graph.issues.length > 0 ? 1 : 0);
