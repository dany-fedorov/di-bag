import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

test('the README quotes the missing-service message exactly as the error index states it', () => {
  const readme = readFileSync(resolve(root, 'README.md'), 'utf8');
  const errors = readFileSync(resolve(root, 'docs/agent/errors.md'), 'utf8');
  const section = readme.slice(readme.indexOf('## What the compiler catches'));
  const quoted = section.match(/```text\n([^\n]+)\n```/)?.[1];
  assert.ok(quoted, 'README has a text block quoting the compiler message');
  const template = errors.match(/`(required services are missing: <keys>; see [^`]+)`/)?.[1];
  assert.ok(template, 'errors.md states the missing-service message template');
  assert.equal(quoted, template.replace('<keys>', 'config'));
  assert.match(section, /`provided service does not satisfy its consumer dependency`/);
  assert.ok(errors.includes('provided service does not satisfy its consumer dependency'), 'errors.md states the wrong-shape message');
});
