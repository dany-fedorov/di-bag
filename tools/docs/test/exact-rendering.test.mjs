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
let container;
let fromPlugin;
let tokenKey;
let runtimeOptions;
let readinessError;
let acquisitionContext;
let contextualFactory;
let pluginOutputValidator;
let provider;
let builder;
let moduleInterface;
let token;
let configurationOptions;
let lifecycleObserver;
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
  container = readFileSync(join(output, 'index/interfaces/Container.md'), 'utf8');
  fromPlugin = readFileSync(join(output, 'index/type-aliases/PluginProviderFactory.md'), 'utf8');
  tokenKey = readFileSync(join(output, 'index/type-aliases/TokenKey.md'), 'utf8');
  runtimeOptions = readFileSync(join(output, 'index/interfaces/RuntimeOptions.md'), 'utf8');
  readinessError = readFileSync(join(output, 'index/classes/DiBagServiceReadinessError.md'), 'utf8');
  acquisitionContext = readFileSync(join(output, 'index/interfaces/AcquisitionContext.md'), 'utf8');
  contextualFactory = readFileSync(join(output, 'index/type-aliases/ContextualFactory.md'), 'utf8');
  pluginOutputValidator = readFileSync(join(output, 'index/type-aliases/PluginOutputValidator.md'), 'utf8');
  provider = readFileSync(join(output, 'index/interfaces/Provider.md'), 'utf8');
  builder = readFileSync(join(output, 'index/interfaces/Builder.md'), 'utf8');
  moduleInterface = readFileSync(join(output, 'index/interfaces/Module.md'), 'utf8');
  token = readFileSync(join(output, 'index/interfaces/Token.md'), 'utf8');
  configurationOptions = readFileSync(join(output, 'index/interfaces/ConfigurationOptions.md'), 'utf8');
  lifecycleObserver = readFileSync(join(output, 'index/interfaces/LifecycleObserver.md'), 'utf8');
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
  const containerText = compact(container);

  assert.match(facadeText, /fromClass: <const T extends readonly DependencyReference\[\], C extends new \(/);
  assert.match(facadeText, /M extends AcquisitionMode = 'auto'>/);
  assert.match(facadeText, /callback: F & NativeOutput<ReturnType<NoInfer<F>>, NoInfer<M>> & AutoOutput<ReturnType<NoInfer<F>>, NoInfer<M>>, \.\.\.options: FactoryOptions<M>/);
  assert.match(containerText, /resolve<K extends \(keyof ServiceRegistrations & string\) \| TokenBase>\(token: K & \(\[K\] extends \[string\] \? unknown : SingleServiceTokenMember<ServiceRegistrations, K>\)\)/);
  assert.match(containerText, /resolveCollection<T extends CollectionTokenBase>\(token: T & CollectionTokenMember<Constraints, T>, \.\.\.invalid: \[T\] extends \[never\] \? \[never\] : \[\]\): readonly CollectionItem<T>\[\];/);
  assert.match(containerText, /serviceSnapshot<ServiceKey extends \(keyof ServiceRegistrations & string\) \| TokenBase>\(serviceKey: ServiceKey & \(\[ServiceKey\] extends \[string\] \? unknown : SingleServiceTokenMember<ServiceRegistrations, ServiceKey>\), \.\.\.invalid: \[ServiceKey\] extends \[never\] \? \[never\] : \[\]\): RegistrationSnapshot<ProviderRegistrationMetadata/);
  assert.match(containerText, /serviceSnapshot<CollectionToken extends CollectionTokenBase>\(collectionToken: CollectionToken & CollectionTokenMember<Constraints, CollectionToken>, \.\.\.invalid: \[CollectionToken\] extends \[never\] \? \[never\] : \[\]\): readonly RegistrationSnapshot<object, readonly unknown\[\]>\[\];/);
  assert.match(containerText, /\[ServiceKey\] extends \[CollectionTokenBase\] \? CollectionTokenMember<Constraints, ServiceKey> : SingleServiceTokenMember<ServiceRegistrations, ServiceKey>/);
  assert.match(containerText, /TokenBase extends ServiceKey \? RegistrationSnapshot<object, readonly unknown\[\]> \| readonly RegistrationSnapshot<object, readonly unknown\[\]>\[\]/);
  assert.match(containerText, /graphSnapshot\(\): GraphSnapshot/);
  assert.match(containerText, /createChildContainer<const SharedParentServiceKeys extends readonly unknown\[\]>/);
  assert.match(containerText, /createIndependentContainer<const ReplacedServiceKeys extends readonly unknown\[\]/);
  assert.match(compact(moduleInterface), /withRenamedExport<const CurrentExportKey extends string, const NewExportKey extends string>/);
  assert.match(compact(configurationOptions), /readonly lifecycleObservers\?: readonly LifecycleObserver\[\]/);
  assert.match(lifecycleObserver, /readonly onLifecycleEvent: ObserverCallback;/);
  assert.match(lifecycleObserver, /readonly onObserverFailure: ObserverErrorCallback;/);
});

test('canonical signatures are followed by comment-only parameter details', () => {
  assert.match(container, /\| Parameter \| Description \|/);
  assert.doesNotMatch(container, /\| Parameter \| Type \|/);
  assert.match(container, /\| Type Parameter \| Description \|/);
  assert.match(facade, /\| `create` \| The receiver-free service factory\. \|/);
});

test('source declarations preserve aliases and property modifiers exactly', () => {
  assert.match(compact(tokenKey), /type TokenKey<T> = T extends infer U & \{\} \? U extends Token<infer K, infer _S> \? K : U extends CollectionToken<infer K, infer _Item> \? K : never : never;/);
  assert.match(runtimeOptions, /readonly isNativePromise: \(this: void, candidate: unknown\) => boolean;/);
  assert.match(readinessError, /readonly disposalError\?: unknown;/);
  assert.doesNotMatch(readinessError, /readonly optional/);
  const collectionContribution = readFileSync(join(output, 'index/type-aliases/BuilderWithCollectionContribution.md'), 'utf8');
  const collectionContributionText = compact(collectionContribution);
  assert.match(collectionContribution, /^# Type Alias: BuilderWithCollectionContribution/m);
  assert.match(collectionContributionText, /readonly collectionToken:/);
  assert.match(collectionContributionText, /readonly provider:/);
  assert.match(collectionContributionText, /Builder<E, C \| Contribution<T, V>>;/);

  const callablePages = [
    ['type-aliases', 'BuilderWithServices'],
    ['type-aliases', 'BuilderWithTokenService'],
    ['type-aliases', 'BuilderWithServiceAlias'],
    ['interfaces', 'BuilderWithReplacedService'],
    ['type-aliases', 'BuilderWithInstalledModules'],
    ['interfaces', 'BuilderBuildModule'],
  ];
  for (const [kind, name] of callablePages) {
    const page = readFileSync(join(output, `index/${kind}/${name}.md`), 'utf8');
    assert.match(page, new RegExp(`^# (?:Type Alias|Interface): ${name}`, 'm'));
  }
  const tokenService = compact(readFileSync(join(output, 'index/type-aliases/BuilderWithTokenService.md'), 'utf8'));
  assert.match(tokenService, /token: TokenHandle/);
  assert.match(tokenService, /provider: Provider/);
  const replacement = compact(readFileSync(join(output, 'index/interfaces/BuilderWithReplacedService.md'), 'utf8'));
  assert.equal((replacement.match(/serviceKey:/g) ?? []).length, 2);
  const buildModule = compact(readFileSync(join(output, 'index/interfaces/BuilderBuildModule.md'), 'utf8'));
  assert.match(buildModule, /options: ModuleOptions/);
  assert.match(buildModule, /readonly exportedServiceKeys:/);
});

test('plugin factory is a callable type alias rather than a type-only function export', () => {
  assert.match(fromPlugin, /^# Type Alias: PluginProviderFactory$/m);
  assert.match(compact(fromPlugin), /type PluginProviderFactory = <const T extends readonly DependencyReference\[\], V, M extends PluginAcquisitionMode>/);
});

test('documented parameter names carry no abbreviations', () => {
  assert.match(acquisitionContext, /pushDisposer\(this: void, disposer: \(this: void, disposerContext: DisposerContext\) => void \| Promise<void>\): void;/);
  assert.match(compact(contextualFactory), /\(this: void, dependencies: Parameters<F> extends \[\] \? \{\s?\} : Parameters<F>\[0\]\) => ReturnType<F>;/);
  for (const page of [facade, container, builder, acquisitionContext, contextualFactory]) assert.doesNotMatch(page, /\b(?:factoryCtx|disposerCtx|deps)\b/);
});

test('callback parameters in public signatures are named by role', () => {
  const facadeText = compact(facade);
  assert.match(facadeText, /dispose: \(this: void, acquiredValue: Awaited<ReturnType<NoInfer<F>>>\) => void \| Promise<void>/);
  assert.match(facadeText, /dispose: \(this: void, acquiredValue: ProviderAcquiredValue<NoInfer<R>>\) => void \| Promise<void>/);
  assert.match(facadeText, /P extends \(this: void, exposedService: ProviderOutput<NoInfer<R>>\) =>/);
  assert.match(facadeText, /P extends \(this: void, fulfilledValue: Awaited<ProviderOutput<NoInfer<R>>>\) =>/);
  assert.doesNotMatch(facadeText, /\(this: void, value:/);
  assert.match(pluginOutputValidator, /type PluginOutputValidator<V> = \(this: void, pluginOutput: unknown\) => pluginOutput is V;/);
});

test('exported classes name their type parameters by role', () => {
  assert.match(container, /^# Interface: Container\\<ServiceRegistrations \*extends\* `Registrations`, Constraints \*extends\* `NeedConstraint` = `never`\\>$/m);
  assert.match(builder, /^# Interface: Builder\\<Entries \*extends\* `Entry`, Constraints \*extends\* `NeedConstraint` = `never`\\>$/m);
  assert.match(moduleInterface, /^# Interface: Module\\<ExportedServices \*extends\* `object`, RequiredServices \*extends\* `object`, Constraints \*extends\* /m);
  assert.match(provider, /^# Interface: Provider\\<ExposedFactory \*extends\* `Factory`, RegistrationMetadata \*extends\* /m);
  assert.match(token, /^# Interface: Token\\<TokenSymbol \*extends\* `symbol`, Service\\>$/m);
  assert.match(container, /\| `ServiceRegistrations` \| The map from each public service name or token symbol to its registration\. \|/);
  assert.match(builder, /\| `Entries` \| The union of accepted registration entries, one per public key\. \|/);
  assert.match(moduleInterface, /\| `RequiredServices` \| The services the installing builder must provide\. \|/);
  assert.match(token, /\| `TokenSymbol` \| The unique symbol that is this token's runtime identity\. \|/);
});
