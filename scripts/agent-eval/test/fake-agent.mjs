// Stand-in for a coding agent: copies prepared module directories into the sandbox.
// usage: fake-agent.mjs --solution <dir> --sandbox <dir> --module <name|all> --transcript <path>
//        [--iterations <n>] [--sleep <ms>] [--outside]
import { cpSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { setTimeout as sleep } from 'node:timers/promises';

const { values } = parseArgs({
  options: {
    solution: { type: 'string' },
    sandbox: { type: 'string' },
    module: { type: 'string' },
    transcript: { type: 'string' },
    iterations: { type: 'string' },
    sleep: { type: 'string' },
    outside: { type: 'boolean', default: false },
  },
});

if (values.sleep) await sleep(Number(values.sleep));
const names = values.module === 'all' ? ['catalog', 'inventory', 'checkout', 'notifications'] : [values.module];
for (const name of names) {
  const source = join(values.solution, name);
  if (existsSync(source)) cpSync(source, join(values.sandbox, 'src', 'features', name), { recursive: true });
}
if (values.outside) writeFileSync(join(values.sandbox, 'NOTES.md'), 'notes\n');
if (values.iterations) writeFileSync(values.transcript, JSON.stringify({ iterations: Number(values.iterations), model: 'fake' }));
