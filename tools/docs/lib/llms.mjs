import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const site = 'https://dany-fedorov.github.io/di-bag/';

/** The pages an agent needs, in reading order, with their website address. */
const pages = [
  { file: 'AGENTS.md', title: 'AGENTS.md', url: `${site}llms-full.txt#agents-md` },
  { file: 'docs/agent/api-card.md', title: 'API card', url: `${site}agent/api-card.html` },
  { file: 'docs/agent/recipes.md', title: 'Recipes', url: `${site}agent/recipes.html` },
  { file: 'docs/agent/errors.md', title: 'Errors and messages', url: `${site}agent/errors.html` },
];

/** Rewrite the relative links the shipped pages use among themselves to website addresses. */
function absoluteLinks(markdown) {
  return markdown.replace(/\]\((?:\.\.\/\.\.\/|docs\/agent\/|)?(AGENTS\.md|api-card\.md|recipes\.md|errors\.md)(#[^)]*)?\)/g, (_, file, fragment = '') => {
    const page = pages.find(page => page.file.endsWith(`/${file}`) || page.file === file);
    return `](${page.url.split('#')[0]}${file === 'AGENTS.md' ? '#agents-md' : fragment})`;
  });
}

/** The llms.txt index: what DI Bag is and where each agent page lives. */
export function renderLlmsIndex() {
  return [
    '# DI Bag', '',
    '> TypeScript dependency injection where the compiler checks the wiring, modules keep a feature\'s services private, and a container releases what it owns when closed. Zero runtime dependencies.', '',
    'The same pages ship in the npm package under `node_modules/di-bag/`. Read AGENTS.md first.', '',
    '## Agent pages', '',
    ...pages.map(page => `- [${page.title}](${page.url})`), '',
    '## Full text', '',
    `- [llms-full.txt](${site}llms-full.txt): every page above in one file`, '',
  ].join('\n');
}

/** Every agent page, in order, with links made absolute. */
export function renderLlmsFull(root) {
  return pages.map(page => {
    const text = readFileSync(join(root, page.file), 'utf8').replace(/\n$/, '');
    return `<!-- ${page.file} -->\n${page.file === 'AGENTS.md' ? '<a id="agents-md"></a>\n' : ''}${absoluteLinks(text)}\n`;
  }).join('\n');
}
