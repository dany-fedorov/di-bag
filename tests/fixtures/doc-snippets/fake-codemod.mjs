// Stands in for the codemod: it renames two calls in every project snippet.
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const project = process.argv[process.argv.indexOf('--project') + 1];
const report = process.argv[process.argv.indexOf('--report') + 1];
const walk = directory => readdirSync(directory).flatMap(name => { const path = join(directory, name); return statSync(path).isDirectory() ? walk(path) : [path]; });
for (const file of walk(join(dirname(project), 'snippets'))) {
  const text = readFileSync(file, 'utf8');
  writeFileSync(file, text.replaceAll('.register(', '.withServices(').replace('.build();', '\n  .buildContainer();'));
}
writeFileSync(report, JSON.stringify({ manual: [{ file: 'snippets/x.ts', line: 1, reason: 'a reason a person must read' }] }));
