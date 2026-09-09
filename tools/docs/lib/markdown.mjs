import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, posix } from 'node:path';

/** Sorted relative files make generation checks independent of traversal order. */
export function listFiles(root, prefix = '') {
  if (!existsSync(root)) return [];
  return readdirSync(join(root, prefix), { withFileTypes: true })
    .flatMap(entry => {
      const file = posix.join(prefix, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Documentation tree contains a symlink: ${file}`);
      return entry.isDirectory() ? listFiles(root, file) : [file];
    }).sort();
}

/** Compare fresh output to committed Markdown, including added/deleted files. */
export function compareTrees(expected, actual) {
  const left = new Set(listFiles(expected));
  const right = new Set(listFiles(actual));
  return [...new Set([...left, ...right])].sort().flatMap(file => {
    if (!right.has(file)) return [`missing: ${file}`];
    if (!left.has(file)) return [`obsolete: ${file}`];
    return readFileSync(join(expected, file)).equals(readFileSync(join(actual, file)))
      ? [] : [`changed: ${file}`];
  });
}

/** Adapt repository Markdown links only in the disposable website copy. */
export function rewriteMarkdownLinks(markdown, sourcePath, pages, root) {
  const page = pages.get(sourcePath);
  if (!page) throw new Error(`No website route for ${sourcePath}`);
  return markdown.split(/(^```[^\n]*\n[\s\S]*?^```[ \t]*(?:\n|$))/m).map(part => {
    if (part.startsWith('```')) return part;
    return part.replace(/(\[(?:[^\[\]\n]|\[[^\]\n]*\])*\]\()([^\s)]+)(\))/g, (match, open, href, close) => {
      if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(href)) return match;
      const [, path, fragment = ''] = href.match(/^([^?#]*)([?#].*)?$/);
      const resolved = posix.normalize(posix.join(posix.dirname(sourcePath), decodeURIComponent(path)));
      if (pages.has(resolved)) {
        const relative = posix.relative(posix.dirname(page), pages.get(resolved));
        return `${open}${relative}${fragment}${close}`;
      }
      const target = join(root, resolved);
      if (resolved.startsWith('../') || !existsSync(target)) {
        throw new Error(`${sourcePath}: missing documentation link ${href}`);
      }
      const kind = statSync(target).isDirectory() ? 'tree' : 'blob';
      return `${open}https://github.com/dany-fedorov/di-bag/${kind}/main/${encodeURI(resolved)}${fragment}${close}`;
    });
  }).join('');
}
