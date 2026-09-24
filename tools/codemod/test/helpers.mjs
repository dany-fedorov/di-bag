// tools/codemod/test/helpers.mjs
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { loadTypeScript, runCodemod } from '../lib/codemod.mjs';

export const packageRoot = resolve(import.meta.dirname, '..');
export const fixturesRoot = resolve(import.meta.dirname, 'fixtures');
export const compiler = loadTypeScript(fixturesRoot);
const ts = compiler.ts;

/** Every fixture directory: it holds `input.ts`, `expected.ts`, `expected-manual.json` and usually its own `map.json`. */
export const fixtureNames = readdirSync(fixturesRoot, { withFileTypes: true })
  .filter(entry => entry.isDirectory() && existsSync(join(fixturesRoot, entry.name, 'input.ts')))
  .map(entry => entry.name)
  .sort();

let program;
const isolatedFixturePrograms = new Map();
let isolatedFixtureOptions;
const pairedRoots = [
  ['collection-token-alias-source', 'collection-token-alias-use'],
  ['provider-token-classification', 'provider-token-classification-import'],
];

function fixtureOptions() {
  if (isolatedFixtureOptions) return isolatedFixtureOptions;
  const config = compiler.ts.getParsedCommandLineOfConfigFile(join(fixturesRoot, 'tsconfig.json'), {}, {
    ...compiler.ts.sys,
    onUnRecoverableConfigFileDiagnostic: diagnostic => {
      throw new Error(compiler.ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
    },
  });
  isolatedFixtureOptions = { ...config.options, noEmit: true };
  return isolatedFixtureOptions;
}

export function fixtureProgram(name) {
  let program = isolatedFixturePrograms.get(name);
  if (program) return program;
  const roots = pairedRoots.find(group => group.includes(name)) ?? [name];
  program = compiler.ts.createProgram(roots.map(root => join(fixturesRoot, root, 'input.ts')), fixtureOptions());
  for (const root of roots) isolatedFixturePrograms.set(root, program);
  return program;
}
/** One program for all fixtures; the engine never mutates it. */
export function fixturesProgram() {
  if (!program) {
    const config = ts.getParsedCommandLineOfConfigFile(join(fixturesRoot, 'tsconfig.json'), {}, {
      ...ts.sys, onUnRecoverableConfigFileDiagnostic: diagnostic => { throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')); },
    });
    program = ts.createProgram([...config.fileNames, join(fixturesRoot, 'whole-program-pin/source.ts')], { ...config.options, noEmit: true });
  }
  return program;
}

/** Run one fixture with its own map, or with the shipped map when it has none. */
export function runFixture(name) {
  const mapFile = join(fixturesRoot, name, 'map.json');
  const map = existsSync(mapFile) ? JSON.parse(readFileSync(mapFile, 'utf8')) : undefined;
  const result = runCodemod({ typescript: ts, root: fixturesRoot, program: fixtureProgram(name), only: [`${name}/input.ts`], ...(map ? { map } : {}) });
  return {
    text: result.files[0]?.text ?? readFileSync(join(fixturesRoot, name, 'input.ts'), 'utf8'),
    manual: result.manual.map(({ line, reason }) => ({ line, reason })),
    rewrites: result.files[0]?.rewrites ?? 0,
  };
}

export const readFixture = (name, file) => readFileSync(join(fixturesRoot, name, file), 'utf8');
