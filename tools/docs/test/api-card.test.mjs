import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { Application } from 'typedoc';
import { renderApiCard, runtimeSurface } from '../lib/api-card.mjs';
import { cardBudget, parseMarkdown } from '../lib/agent-docs.mjs';

const directory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const app = await Application.bootstrapWithPlugins({ options: resolve(directory, 'typedoc.json') });
const project = await app.convert();
assert(project);
const tasks = JSON.parse(readFileSync(resolve(directory, 'api-card-tasks.json'), 'utf8'));

test('the card covers the runtime surface, links every task, and fits the budget', () => {
  const names = runtimeSurface(project).map(item => item.name);
  for (const name of ['DiBag.createBuilder', 'builder.withServices', 'builder.withCollectionContribution', 'container.close', 'DiBagCloseCancelledError']) assert(names.includes(name), name);
  const markdown = renderApiCard(project, tasks);
  assert.match(markdown, /\| Replace services for a test \| \[`container\.createIndependentContainer\(replacedServiceKeys, replacementProviders\)`\]/);
  assert.doesNotMatch(markdown, /\| Replace services for a test \| \[`container\.createIndependentContainer\(options\?\)`\]/);
  const { headings } = parseMarkdown(markdown);
  const ids = new Set(headings.map(heading => heading.id));
  for (const [, id] of markdown.matchAll(/\]\(#([^)]+)\)/g)) assert(ids.has(id), `task link #${id}`);
  assert(markdown.replace(/\n$/, '').split('\n').length <= cardBudget);
  assert.match(markdown, /Code: \[`DI_BAG_CLOSE_TIMEOUT`\]\(errors\.md#di-bag-close-timeout\), \[`DI_BAG_CLOSE_ABORTED`\]/);
});

test('provider-source API card contains only final task calls', () => {
  const card = renderApiCard(project, tasks);
  for (const name of ['DiBag.createProvider', 'DiBag.createProviderFromFunction', 'DiBag.createProviderFromClass', 'DiBag.createProviderFromPlugin', 'DiBag.createToken']) {
    assert.match(card, new RegExp(name.replace('.', '\\.')));
  }
  for (const name of ['DiBag.fromFactory', 'DiBag.fromSyncFactory', 'DiBag.fromAsyncFactory', 'DiBag.fromFunction', 'DiBag.fromClass', 'DiBag.fromPlugin', 'DiBag.token']) {
    assert.doesNotMatch(card, new RegExp(name.replace('.', '\\.')));
  }
  for (const title of [
    'DiBag.createProvider(factory, options)',
    'DiBag.createProviderFromFunction(options)',
    'DiBag.createProviderFromClass(options)',
    'DiBag.createProviderFromPlugin(options)',
    'DiBag.createToken(symbol)',
  ]) assert.ok(card.includes(`### \`${title}\``), `missing call title: ${title}`);
});

test('the card refuses a runtime call without an @example', () => {
  const container = project.children.find(child => child.name === 'index').children.find(child => child.name === 'Container');
  const close = container.children.find(child => child.name === 'close');
  const comments = close.signatures.map(signature => signature.comment);
  const saved = comments.map(comment => comment?.blockTags);
  try {
    for (const comment of comments) if (comment) comment.blockTags = comment.blockTags.filter(tag => tag.tag !== '@example');
    assert.throws(() => renderApiCard(project, tasks), /container\.close: add an @example/);
  } finally { comments.forEach((comment, index) => { if (comment) comment.blockTags = saved[index]; }); }
});

test('the task table maps each task to exactly one known call', () => {
  assert.throws(() => renderApiCard(project, [{ task: 'Resolve', call: 'container.get' }]), /"Resolve" names unknown call container\.get/);
  assert.throws(() => renderApiCard(project, [{ task: 'Replace for a test', call: ['container.createIndependentContainer', 'builder.withReplacedService'] }]), /needs a task and exactly one call/);
});

test('requirement renaming has one task and a documented runtime call', () => {
  assert.equal(tasks.filter(task => task.call === 'module.withRenamedRequirement').length, 1);
  const installIndex = tasks.findIndex(task => task.call === 'builder.withInstalledModules');
  assert.deepEqual(tasks[installIndex + 1], { task: 'Rename a module requirement', call: 'module.withRenamedRequirement' });
  const moduleEntries = runtimeSurface(project).filter(item => item.group === 'Module');
  assert.deepEqual(moduleEntries.map(item => item.name), ['module.withRenamedRequirement']);
  assert(moduleEntries[0].examples.length > 0);
  assert.deepEqual(moduleEntries[0].codes, [
    'DI_BAG_INVALID_ARGUMENT', 'DI_BAG_UNKNOWN_SERVICE_KEY', 'DI_BAG_DUPLICATE_SERVICE_KEY',
  ]);
  assert.match(renderApiCard(project, tasks), /\| Rename a module requirement \| \[`module\.withRenamedRequirement\(options\)`\]\(#module-withrenamedrequirement\) \|/);
});

test('every public Module method is classified for the API card', () => {
  const included = new Set(['withRenamedRequirement']);
  const excluded = new Set(['withRenamedExport']);
  const module = project.children.find(child => child.name === 'index').children.find(child => child.name === 'Module');
  const reflected = module.children.filter(child => child.name !== 'constructor').map(child => child.name);
  const checkClassification = names => {
    assert.deepEqual([...included].filter(name => excluded.has(name)), [], 'included and excluded Module methods must be disjoint');
    assert.deepEqual([...names].sort(), [...included, ...excluded].sort(), 'every reflected public Module method must be classified');
    assert.deepEqual(runtimeSurface(project).filter(item => item.group === 'Module').map(item => item.name),
      [...included].map(name => `module.${name}`));
  };
  checkClassification(reflected);
  assert.throws(() => checkClassification([...reflected, 'withFutureMethod']), /every reflected public Module method must be classified/);
});
