import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { Application } from 'typedoc';
import { installExactRendering } from '../lib/exact-rendering.mjs';

const directory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const temporary = mkdtempSync(join(tmpdir(), 'di-bag-exact-rendering-'));
const output = join(temporary, 'reference');

const previousDirectory = process.cwd();
let facade;
let bag;
let fromPlugin;
let tokenKey;
let runtimeOptions;
let startupError;
try {
  process.chdir(directory);
  const app = await Application.bootstrapWithPlugins({ options: resolve(directory, 'typedoc.json') });
  installExactRendering(app);
  app.options.setValue('out', output);
  app.options.setValue('docsRoot', temporary);
  const project = await app.convert();
  assert(project);
  await app.generateOutputs(project);

  facade = readFileSync(join(output, 'index/interfaces/DiBagApi.md'), 'utf8');
  bag = readFileSync(join(output, 'index/interfaces/Bag.md'), 'utf8');
  fromPlugin = readFileSync(join(output, 'index/type-aliases/PluginProviderFactory.md'), 'utf8');
  tokenKey = readFileSync(join(output, 'index/type-aliases/TokenKey.md'), 'utf8');
  runtimeOptions = readFileSync(join(output, 'index/interfaces/RuntimeOptions.md'), 'utf8');
  startupError = readFileSync(join(output, 'index/classes/DiBagStartupError.md'), 'utf8');
} catch (error) {
  rmSync(temporary, { recursive: true, force: true });
  throw error;
} finally {
  process.chdir(previousDirectory);
}
const compact = (value) => value.replace(/\s+/g, ' ');

test.after(() => rmSync(temporary, { recursive: true, force: true }));

test('compiler declarations retain syntax that TypeDoc reflections cannot represent', () => {
  const facadeText = compact(facade);
  const bagText = compact(bag);

  assert.match(facadeText, /fromClass: <const T extends readonly DependencyReference\[\], C extends new \(/);
  assert.match(facadeText, /M extends AcquisitionMode = 'auto'>/);
  assert.match(facadeText, /callback: F & NativeOutput<ReturnType<NoInfer<F>>, NoInfer<M>>, \.\.\.options: FactoryOptions<M>/);
  assert.match(bagText, /inspect<K extends \(keyof R & string\) \| TokenBase>\(token: K & \(\[K\] extends \[string\] \? unknown : TokenMember<R, K>\)\)/);
  assert.match(bagText, /createScope<const S extends readonly unknown\[\]>/);
});

test('canonical signatures are followed by comment-only parameter details', () => {
  assert.match(bag, /\| Parameter \| Description \|/);
  assert.doesNotMatch(bag, /\| Parameter \| Type \|/);
  assert.match(bag, /\| Type Parameter \| Description \|/);
  assert.match(facade, /\| `create` \| The receiver-free service factory\. \|/);
});

test('source declarations preserve aliases and property modifiers exactly', () => {
  assert.match(compact(tokenKey), /type TokenKey<T> = T extends infer U & \{\} \? U extends Token<infer K, infer _S> \? K : never : never;/);
  assert.match(runtimeOptions, /readonly isNativePromise: \(this: void, value: unknown\) => boolean;/);
  assert.match(startupError, /readonly cleanupError\?: unknown;/);
  assert.doesNotMatch(startupError, /readonly optional/);
  const builderContribute = readFileSync(join(output, 'index/type-aliases/BuilderContribute.md'), 'utf8');
  assert.match(compact(builderContribute), /<T extends TokenBase, V extends Registration>/);
  assert.match(compact(builderContribute), /Builder<E, C \| Contribution<T, V>>;/);
});

test('plugin factory is a callable type alias rather than a type-only function export', () => {
  assert.match(fromPlugin, /^# Type Alias: PluginProviderFactory$/m);
  assert.match(compact(fromPlugin), /type PluginProviderFactory = <const T extends readonly DependencyReference\[\], V, M extends PluginAcquisitionMode>/);
});
