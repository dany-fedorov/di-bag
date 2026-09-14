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
  for (const name of ['DiBag.createBuilder', 'builder.register', 'builder.contribute', 'bag.close', 'DiBagCloseCancelledError']) assert(names.includes(name), name);
  const markdown = renderApiCard(project, tasks);
  const { headings } = parseMarkdown(markdown);
  const ids = new Set(headings.map(heading => heading.id));
  for (const [, id] of markdown.matchAll(/\]\(#([^)]+)\)/g)) assert(ids.has(id), `task link #${id}`);
  assert(markdown.replace(/\n$/, '').split('\n').length <= cardBudget);
  assert.match(markdown, /Code: \[`DI_BAG_CLOSE_TIMEOUT`\]\(errors\.md#di-bag-close-timeout\), \[`DI_BAG_CLOSE_ABORTED`\]/);
});

test('the card refuses a runtime call without an @example', () => {
  const bag = project.children.find(child => child.name === 'index').children.find(child => child.name === 'Bag');
  const close = bag.children.find(child => child.name === 'close');
  const comments = close.signatures.map(signature => signature.comment);
  const saved = comments.map(comment => comment?.blockTags);
  try {
    for (const comment of comments) if (comment) comment.blockTags = comment.blockTags.filter(tag => tag.tag !== '@example');
    assert.throws(() => renderApiCard(project, tasks), /bag\.close: add an @example/);
  } finally { comments.forEach((comment, index) => { if (comment) comment.blockTags = saved[index]; }); }
});

test('the task table maps each task to exactly one known call', () => {
  assert.throws(() => renderApiCard(project, [{ task: 'Resolve', call: 'bag.get' }]), /"Resolve" names unknown call bag\.get/);
  assert.throws(() => renderApiCard(project, [{ task: 'Replace for a test', call: ['bag.fork', 'builder.replace'] }]), /needs a task and exactly one call/);
});
