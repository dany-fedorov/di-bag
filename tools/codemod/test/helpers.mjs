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
/** One program for all fixtures; the engine never mutates it. */
export function fixturesProgram() {
  if (!program) {
    const config = ts.getParsedCommandLineOfConfigFile(join(fixturesRoot, 'tsconfig.json'), {}, {
      ...ts.sys, onUnRecoverableConfigFileDiagnostic: diagnostic => { throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')); },
    });
    program = ts.createProgram(config.fileNames, { ...config.options, noEmit: true });
  }
  return program;
}

/** Run one fixture with its own map, or with the shipped map when it has none. */
export function runFixture(name) {
  const mapFile = join(fixturesRoot, name, 'map.json');
  const map = existsSync(mapFile) ? JSON.parse(readFileSync(mapFile, 'utf8')) : undefined;
  const result = runCodemod({ typescript: ts, root: fixturesRoot, program: fixturesProgram(), only: [`${name}/input.ts`], ...(map ? { map } : {}) });
  return {
    text: result.files[0]?.text ?? readFileSync(join(fixturesRoot, name, 'input.ts'), 'utf8'),
    manual: result.manual.map(({ line, reason }) => ({ line, reason })),
  };
}

export const readFixture = (name, file) => readFileSync(join(fixturesRoot, name, file), 'utf8');
