// tools/codemod/test/load-typescript.test.mjs
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { loadTypeScript } from '../lib/load-typescript.mjs';

const temporaryRoot = mkdtempSync(join(tmpdir(), 'di-bag-codemod-loader-'));
after(() => rmSync(temporaryRoot, { force: true, recursive: true }));

function projectWithTypeScript(name, version, { compilerApi = true } = {}) {
  const project = join(temporaryRoot, name);
  const typescript = join(project, 'node_modules', 'typescript');
  mkdirSync(typescript, { recursive: true });
  writeFileSync(join(project, 'package.json'), '{"private":true}');
  writeFileSync(join(typescript, 'package.json'), '{"main":"index.cjs"}');
  writeFileSync(
    join(typescript, 'index.cjs'),
    `exports.version = ${JSON.stringify(version)}; exports.marker = ${JSON.stringify(name)};${compilerApi ? ' exports.createProgram = () => undefined;' : ''}`,
  );
  return project;
}

test('selects a project compiler with the current compatible API version', () => {
  const loaded = loadTypeScript(projectWithTypeScript('current', '6.0.3'));

  assert.equal(loaded.source, 'project');
  assert.equal(loaded.version, '6.0.3');
  assert.equal(loaded.ts.marker, 'current');
});

test('falls back to the bundled compiler when the project API is too old', () => {
  const loaded = loadTypeScript(projectWithTypeScript('too-old', '6.0.2'));

  assert.equal(loaded.source, 'bundled');
  assert.notEqual(loaded.ts.marker, 'too-old');
});

test('falls back to the bundled compiler when the project exposes no compiler API', () => {
  const loaded = loadTypeScript(projectWithTypeScript('no-api', '9.0.0', { compilerApi: false }));

  assert.equal(loaded.source, 'bundled');
  assert.notEqual(loaded.ts.marker, 'no-api');
});

test('selects a higher-version project compiler when its API remains compatible', () => {
  const loaded = loadTypeScript(projectWithTypeScript('higher-compatible', '7.0.0'));

  assert.equal(loaded.source, 'project');
  assert.equal(loaded.version, '7.0.0');
  assert.equal(loaded.ts.marker, 'higher-compatible');
});
