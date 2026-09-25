import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const script = resolve(__dirname, '../scripts/generate-migration-guide.mjs');
const fixtures = resolve(__dirname, 'fixtures/migration-guide');
function workspace() {
  const guide = join(mkdtempSync(join(tmpdir(), 'migration-guide-')), 'guide.md');
  copyFileSync(join(fixtures, 'guide.md'), guide);
  return { guide, run: (...flags: string[]) => spawnSync('node', [script, '--map', join(fixtures, 'map.json'), '--guide', guide, ...flags], { encoding: 'utf8' }) };
}

test('the tables replace the block between the markers and leave the hand-written text alone', () => {
  const { guide, run } = workspace();
  const result = run();
  expect(result.status).toBe(0);
  expect(result.stdout).toContain('23 rows');
  const text = readFileSync(guide, 'utf8');
  expect(text.startsWith('# Migrating\n\nWritten by hand, above.\n\n<!-- generated:rename-tables:start -->\n')).toBe(true);
  expect(text.endsWith('<!-- generated:rename-tables:end -->\n\nWritten by hand, below.\n')).toBe(true);
  expect(text).not.toContain('old block');
  expect(text).toContain('### Container, which was `Bag`\n\n| 0.4.0 | 0.5.0 |\n| --- | --- |\n| `resolveAll(...)` | by hand: resolveCollection(collectionToken) |');
  expect(text).toContain('| `alias(...)` | by hand: builder.withServiceAlias({ aliasKey, targetServiceKey }) |');
  expect(text).toContain('| `buildAndStart(...)` | by hand: builder.buildContainer().ensureServicesReady(serviceKeys, options); rename signal to abortSignal and timeoutMs to totalTimeoutMs; replace startupOrder with maxConcurrentServiceKeys (omit for parallel, 1 for sequential, or the number); options may be omitted |');
  expect(text.match(/^\| `register\(\.\.\.\)` \|/gm)).toHaveLength(1);
  expect(text).toContain('| `register(...)` | by hand: builder.withServices({ key: provider }) or builder.withTokenService(token, provider) |');
  expect(text).toContain('| `all(...)` | by hand: the collection token itself, from DiBag.createToken(symbol).forCollectionOf&lt;Item&gt;() |');
  expect(text).toContain('| `of(...)` | by hand: DiBag.createToken(symbol).forService&lt;Service&gt;() or DiBag.createToken(symbol).forCollectionOf&lt;Item&gt;(); choose the kind manually from its uses, and split mixed single-service and collection uses into tokens with distinct symbols |');
  expect(text).not.toContain('forCollectionOf<Item>');
  expect(text).toContain('| `withMetadata(...)` | by hand: DiBag.providerWithRegistrationMetadata({ provider, registrationMetadata }) for static metadata, or DiBag.providerWithAcquisitionMetadata({ provider, describeAcquisition, callbackReceives }) for dynamic metadata; map mode direct -&gt; exposed-service or awaited -&gt; fulfilled-value; combined static and dynamic metadata requires manually composing both calls while preserving evaluation order |');
  expect(text).toContain('| `withLifetime(...)` | by hand: DiBag.providerWithLifetime({ provider, lifetime }); map root -&gt; singleton:one-per-container-tree, scoped -&gt; scoped:one-per-container, or transient -&gt; transient:one-per-resolve; move allowScopedDependencies into this object as allowsScopedDependencies |');
  expect(text).toContain('| `transformService(...)` | by hand: DiBag.providerWithTransformedService({ provider, transformService, callbackReceives }); map mode direct -&gt; exposed-service or awaited -&gt; fulfilled-value; for exposed-service callbacks, rename acquisitionMode to transformReturnKind (auto -&gt; auto-detect, raw -&gt; uninspected, nativePromise -&gt; native-promise) |');
  expect(text).toContain('| `close({ signal })` | `close({ abortSignal })` |');
  expect(text).toContain('| `withLifetime({ allowScopedDependencies })` | `providerWithLifetime({ allowsScopedDependencies })` |');
  expect(text).toContain('| `transformService({ acquisitionMode })` | `providerWithTransformedService({ transformReturnKind })` |');
  expect(text).toContain("| `'root'` in `withLifetime(...)` | `'singleton:one-per-container-tree'` |");
  expect(text).toContain("| `'scope-opened'` in `LifecycleEvent.kind` | `'container-opened'` |");
  expect(text).toContain("| `Mode` | `ReturnKind`; map literal values `'auto'` to `'auto-detect'`, `'raw'` to `'uninspected'` |");
  expect(text).toContain("| `Options` | `NewOptions`; in generic argument 1, map `'raw'` to `'uninspected'` |");
  expect(text).toContain("| `Provider` | `Provider`; in generic argument 3, map `'nativePromise'` to `'native-promise'` |");
  expect(text).toContain('| `DI_BAG_INVALID_SCOPE` | by hand: split: DI_BAG_UNKNOWN_SERVICE_KEY \\| DI_BAG_INVALID_ARGUMENT |');
  expect(text).toContain("| `'di-bag/node'` | `'di-bag'` |");
  expect(text).not.toContain('/src/node');
});

test('--check accepts a current guide, rejects a stale one, and a guide without markers is an error', () => {
  const { guide, run } = workspace();
  expect(run('--check').status).toBe(1);
  expect(run().status).toBe(0);
  expect(run('--check').status).toBe(0);
  writeFileSync(guide, '# no markers\n');
  const broken = run();
  expect(broken.status).toBe(2);
  expect(broken.stderr).toContain('needs the two markers');
});

test('the committed guide holds the tables that the real map produces', () => {
  const result = spawnSync('node', [script, '--check'], { cwd: resolve(__dirname, '..'), encoding: 'utf8' });
  expect(result.stderr).toBe('');
  expect(result.status).toBe(0);
});
