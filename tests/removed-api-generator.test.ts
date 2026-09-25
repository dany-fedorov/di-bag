import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const script = resolve(__dirname, '../scripts/generate-removed-api.mjs');
const map = resolve(__dirname, 'fixtures/removed-api/map.json');
const run = (out: string, ...flags: string[]) => spawnSync('node', [script, '--map', map, '--out', out, ...flags], { encoding: 'utf8' });

test('one stub per removed callable name, none for a name that is still live', () => {
  const out = join(mkdtempSync(join(tmpdir(), 'removed-api-')), 'removed-api.ts');
  const result = run(out);
  expect(result.status).toBe(0);
  expect(result.stdout).toContain('10 stubs for 3 owners');
  const text = readFileSync(out, 'utf8');
  // Renamed: a stub that names the new call, with the receiver a reader would type.
  expect(text).toContain('"fromFactory": "DiBag.createProvider",');
  expect(text).toContain('"build": "builder.buildContainer",');
  expect(text).toContain('"inspect": "container.serviceSnapshot",');
  // Moved to another object under the SAME name: still a stub on the old owner.
  expect(text).toContain('"withDisposal": "DiBag.providerWithDisposal({ provider, disposeService })",');
  expect(text).toContain('"withLifetime": "DiBag.providerWithLifetime({ provider, lifetime })",');
  expect(text).toContain('"withMetadata": "DiBag.providerWithRegistrationMetadata({ provider, registrationMetadata }) or DiBag.providerWithAcquisitionMetadata({ provider, describeAcquisition, callbackReceives })",');
  expect(text).toContain('"transformService": "DiBag.providerWithTransformedService({ provider, transformService, callbackReceives })",');
  // No single successor: the sentence from the map, or from the script's table.
  expect(text).toContain('"resolveAll": "resolveCollection(collectionToken)",');
  expect(text).toContain('"buildAndStart": "buildContainer(), then container.ensureServicesReady(serviceKeys)",');
  // Only the arguments changed: the name is live and gets no stub.
  expect(text).not.toContain('"buildModule"');
});

test('--check accepts the generated file and rejects a stale one', () => {
  const out = join(mkdtempSync(join(tmpdir(), 'removed-api-')), 'removed-api.ts');
  expect(run(out).status).toBe(0);
  expect(run(out, '--check').status).toBe(0);
  writeFileSync(out, readFileSync(out, 'utf8').replace('createProvider', 'somethingElse'));
  const stale = run(out, '--check');
  expect(stale.status).toBe(1);
  expect(stale.stderr).toContain('is stale');
});
