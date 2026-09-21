// tools/codemod/lib/load-typescript.mjs
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

function atLeast(version, minimum) {
  const parts = String(version).split(/[.-]/).map(Number);
  for (let index = 0; index < minimum.length; index++) {
    if ((parts[index] ?? 0) !== minimum[index]) return (parts[index] ?? 0) > minimum[index];
  }
  return true;
}

/**
 * The project's `typescript` when it exposes the compiler API at 6.0.3 or later, else the bundled copy.
 * A newer project compiler without a compatible JavaScript API is analyzed with the bundled 6.
 * @param {string} from - A directory inside the project.
 * @returns {{ ts: typeof import('typescript'), version: string, source: 'project' | 'bundled' }}
 */
export function loadTypeScript(from) {
  const bundledPath = createRequire(import.meta.url).resolve('typescript');
  try {
    const require = createRequire(resolve(from, 'package.json'));
    const path = require.resolve('typescript');
    const candidate = require(path);
    if (path !== bundledPath && typeof candidate.createProgram === 'function' && atLeast(candidate.version, [6, 0, 3])) {
      return { ts: candidate, version: candidate.version, source: 'project' };
    }
  } catch {
    // No resolvable typescript in the project.
  }
  const bundled = createRequire(import.meta.url)(bundledPath);
  return { ts: bundled, version: bundled.version, source: 'bundled' };
}
