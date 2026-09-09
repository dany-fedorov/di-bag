import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitepress';

const generated = JSON.parse(readFileSync(new URL('../reference/typedoc-sidebar.json', import.meta.url), 'utf8'));
const labels = { index: 'Portable API · di-bag', node: 'Node and Bun · di-bag/node', 'sas-box': 'SasBox adapter', 'val-box': 'ValBox adapter' };
const api = generated.map(group => ({ ...group, text: labels[group.text] ?? group.text }));
const guide = [
  { text: 'Start here', items: [
    { text: 'Introduction', link: '/' },
    { text: 'Complete tutorial', link: '/guides/tutorial' },
    { text: 'Server recipes', link: '/guides/server-integration' },
    { text: 'Integration patterns', link: '/guides/enterprise-integration' },
  ] },
  { text: 'Reference', items: [
    { text: 'API overview', link: '/guides/api-reference' },
    { text: 'DiBag facade', link: '/reference/index/interfaces/Facade' },
    { text: 'Builder', link: '/reference/index/interfaces/Builder' },
    { text: 'Bag', link: '/reference/index/interfaces/Bag' },
    { text: 'All generated APIs', link: '/reference/' },
  ] },
  { text: 'Contribute', items: [
    { text: 'Development', link: '/guides/development' },
    { text: 'Writing and publishing docs', link: '/guides/documentation' },
  ] },
];

export default defineConfig({
  title: 'DI Bag',
  description: 'Type-checked dependency composition with ordinary factories, explicit ownership, and request scopes.',
  base: '/di-bag/',
  lang: 'en-US',
  cleanUrls: false,
  ignoreDeadLinks: false,
  themeConfig: {
    siteTitle: 'DI Bag',
    nav: [
      { text: 'Learn', link: '/guides/tutorial' },
      { text: 'Servers', link: '/guides/server-integration' },
      { text: 'API', link: '/guides/api-reference' },
    ],
    sidebar: {
      '/reference/': [{ text: 'API overview', link: '/guides/api-reference' }, ...api],
      '/': guide,
    },
    outline: { level: [2, 3], label: 'On this page' },
    search: { provider: 'local', options: { detailedView: true } },
    socialLinks: [{ icon: 'github', link: 'https://github.com/dany-fedorov/di-bag' }],
    editLink: {
      text: 'Improve this page on GitHub',
      pattern: ({ filePath }) => `https://github.com/dany-fedorov/di-bag/edit/main/${filePath === 'index.md' ? 'README.md' : `docs/${filePath}`}`,
    },
    footer: { message: 'Ordinary services. Checked composition. Explicit ownership.', copyright: 'MIT · Dany Fedorov' },
  },
});
