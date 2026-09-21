// tools/codemod/lib/glob.mjs
import { existsSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const WILDCARD = /[*?]/;

function toRegExp(pattern) {
  let source = '';
  for (let index = 0; index < pattern.length; index++) {
    const character = pattern[index];
    if (character === '*' && pattern[index + 1] === '*') {
      // `**/` matches any number of directories, including none.
      if (pattern[index + 2] === '/') { source += '(?:.*/)?'; index += 2; } else { source += '.*'; index += 1; }
    } else if (character === '*') source += '[^/]*';
    else if (character === '?') source += '[^/]';
    else source += character.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${source}$`);
}

/**
 * Expand one glob (`*`, `**`, `?`) relative to `root` into sorted absolute file paths.
 * A pattern without wildcards names one file. `node_modules` directories are never entered.
 * @param {string} pattern
 * @param {string} root
 * @returns {string[]}
 */
export function expandGlob(pattern, root) {
  const normalized = pattern.replaceAll('\\', '/');
  if (!WILDCARD.test(normalized)) {
    const file = resolve(root, normalized);
    return existsSync(file) && statSync(file).isFile() ? [file] : [];
  }
  const segments = normalized.split('/');
  const firstWild = segments.findIndex(segment => WILDCARD.test(segment));
  const base = resolve(root, segments.slice(0, firstWild).join('/') || '.');
  if (!existsSync(base)) return [];
  const matcher = toRegExp(segments.slice(firstWild).join('/'));
  const found = [];
  const walk = (directory, prefix) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === 'node_modules') continue;
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(resolve(directory, entry.name), relative);
      else if (matcher.test(relative)) found.push(resolve(directory, entry.name));
    }
  };
  walk(base, '');
  return found.sort();
}
