import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { renderLlmsFull, renderLlmsIndex } from '../lib/llms.mjs';

test('llms.txt indexes the agent pages and llms-full.txt concatenates them with absolute links', () => {
  const root = mkdtempSync(join(tmpdir(), 'di-bag-llms-'));
  try {
    mkdirSync(join(root, 'docs/agent'), { recursive: true });
    writeFileSync(join(root, 'AGENTS.md'), '# DI Bag: notes\n\nSee [card](docs/agent/api-card.md#one-way-per-task).\n');
    writeFileSync(join(root, 'docs/agent/api-card.md'), '# API card\n\nSee [errors](errors.md#di-bag-closed) and [rules](../../AGENTS.md) and [rules section](../../AGENTS.md#rules).\n');
    writeFileSync(join(root, 'docs/agent/recipes.md'), '# Recipes\n');
    writeFileSync(join(root, 'docs/agent/errors.md'), '# Errors\n');
    const index = renderLlmsIndex(root);
    assert.match(index, /^# DI Bag\n/);
    assert.match(index, /- \[AGENTS\.md\]\(https:\/\/github\.com\/dany-fedorov\/di-bag\/blob\/main\/AGENTS\.md\)/);
    assert.match(index, /- \[API card\]\(https:\/\/dany-fedorov\.github\.io\/di-bag\/agent\/api-card\.html\)/);
    assert.match(index, /- \[Recipes\]\(https:\/\/dany-fedorov\.github\.io\/di-bag\/agent\/recipes\.html\)/);
    assert.match(index, /- \[Errors and messages\]\(https:\/\/dany-fedorov\.github\.io\/di-bag\/agent\/errors\.html\)/);
    const full = renderLlmsFull(root);
    assert.ok(full.indexOf('# DI Bag: notes') < full.indexOf('# API card'));
    assert.ok(full.indexOf('# API card') < full.indexOf('# Recipes'));
    assert.ok(full.indexOf('# Recipes') < full.indexOf('# Errors'));
    assert.match(full, /\[card\]\(https:\/\/dany-fedorov\.github\.io\/di-bag\/agent\/api-card\.html#one-way-per-task\)/);
    assert.match(full, /\[errors\]\(https:\/\/dany-fedorov\.github\.io\/di-bag\/agent\/errors\.html#di-bag-closed\)/);
    assert.match(full, /\[rules\]\(https:\/\/github\.com\/dany-fedorov\/di-bag\/blob\/main\/AGENTS\.md\)/);
    assert.match(full, /\[rules section\]\(https:\/\/github\.com\/dany-fedorov\/di-bag\/blob\/main\/AGENTS\.md#rules\)/);
    assert.ok(!full.includes('agents-md'), 'no in-page anchor remains');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
