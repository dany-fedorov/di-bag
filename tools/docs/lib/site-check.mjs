import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { listFiles } from './markdown.mjs';

const decode = value => value.replace(/&(?:amp|quot|apos|lt|gt);/g, entity => ({
  '&amp;': '&', '&quot;': '"', '&apos;': "'", '&lt;': '<', '&gt;': '>',
})[entity]).replace(/&#(x[0-9a-f]+|\d+);/gi, (_, code) => String.fromCodePoint(
  code[0].toLowerCase() === 'x' ? parseInt(code.slice(1), 16) : Number(code),
));

/** Inspect VitePress's rendered HTML, including fragments its build does not check. */
export function verifyBuiltSite(root, base = '/di-bag/') {
  const pages = new Map();
  for (const file of listFiles(root).filter(file => file.endsWith('.html'))) {
    const html = readFileSync(join(root, file), 'utf8');
    const ids = new Set([...html.matchAll(/\bid="([^"]*)"/g)].map(match => decode(match[1])));
    const links = [...html.matchAll(/<(?:a|link|script|img)\b[^>]*>/g)].flatMap(([tag]) => {
      const match = tag.match(/\b(?:href|src)="([^"]*)"/);
      return match ? [decode(match[1])] : [];
    });
    pages.set(file, { ids, links });
  }
  if (!pages.size) throw new Error('No rendered documentation pages found');
  const errors = [];
  let links = 0;
  for (const [file, page] of pages) {
    for (const href of page.links) {
      if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(href)) continue;
      const url = new URL(href, `https://docs.invalid${base}${file}`);
      if (!url.pathname.startsWith(base)) {
        errors.push(`${file}: link outside the Pages base: ${href}`);
        continue;
      }
      let target = decodeURIComponent(url.pathname.slice(base.length));
      if (!target || target.endsWith('/')) target += 'index.html';
      const path = join(root, target);
      if (!existsSync(path) || !statSync(path).isFile()) {
        errors.push(`${file}: missing page or asset: ${href}`);
        continue;
      }
      const fragment = decodeURIComponent(url.hash.slice(1));
      if (fragment && pages.has(target) && !pages.get(target).ids.has(fragment)) {
        errors.push(`${file}: missing anchor: ${href}`);
      }
      links++;
    }
  }
  if (errors.length) throw new Error(errors.join('\n'));
  return { pages: pages.size, links };
}
