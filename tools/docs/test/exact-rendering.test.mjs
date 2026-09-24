import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import ts from 'typescript';
import { Application } from 'typedoc';
import { installExactRendering } from '../lib/exact-rendering.mjs';

const directory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const temporary = mkdtempSync(join(tmpdir(), 'di-bag-exact-rendering-'));
const output = join(temporary, 'reference');

const previousDirectory = process.cwd();
let facade;
let container;
let createProviderFromPlugin;
let tokenKey;
let runtimeOptions;
let readinessError;
let contextualFactory;
let pluginOutputValidator;
let provider;
let builder;
let moduleInterface;
let token;
let configurationOptions;
let lifecycleObserver;
let factoryContext;
let bindingSnapshot;
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
  createProviderFromPlugin = readFileSync(join(output, 'index/type-aliases/CreateProviderFromPlugin.md'), 'utf8');
  tokenKey = readFileSync(join(output, 'index/type-aliases/TokenKey.md'), 'utf8');
  runtimeOptions = readFileSync(join(output, 'index/interfaces/RuntimeOptions.md'), 'utf8');
  readinessError = readFileSync(join(output, 'index/classes/DiBagServiceReadinessError.md'), 'utf8');
  contextualFactory = readFileSync(join(output, 'index/type-aliases/ContextualFactory.md'), 'utf8');
  pluginOutputValidator = readFileSync(join(output, 'index/type-aliases/PluginOutputValidator.md'), 'utf8');
  provider = readFileSync(join(output, 'index/interfaces/Provider.md'), 'utf8');
  builder = readFileSync(join(output, 'index/interfaces/Builder.md'), 'utf8');
  moduleInterface = readFileSync(join(output, 'index/interfaces/Module.md'), 'utf8');
  token = readFileSync(join(output, 'index/interfaces/Token.md'), 'utf8');
  configurationOptions = readFileSync(join(output, 'index/interfaces/ConfigurationOptions.md'), 'utf8');
  lifecycleObserver = readFileSync(join(output, 'index/interfaces/LifecycleObserver.md'), 'utf8');
  factoryContext = readFileSync(join(output, 'index/interfaces/FactoryContext.md'), 'utf8');
  bindingSnapshot = readFileSync(join(output, 'index/interfaces/BindingSnapshot.md'), 'utf8');
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
  assert.match(builder, /graphSnapshot\(\)/);
  assert.doesNotMatch(builder, /inspectGraph\(\)/);
  assert.match(compact(configurationOptions), /readonly lifecycleObservers\?: readonly LifecycleObserver\[\]/);
  assert.match(lifecycleObserver, /readonly onLifecycleEvent: ObserverCallback;/);
  assert.match(lifecycleObserver, /readonly onObserverFailure: ObserverErrorCallback;/);
});

test('canonical signatures are followed by comment-only parameter details', () => {
  assert.match(container, /\| Parameter \| Description \|/);
  assert.doesNotMatch(container, /\| Parameter \| Type \|/);
  assert.match(container, /\| Type Parameter \| Description \|/);
  assert.match(facade, /\| `options` \| The provider and disposer callback\. \|/);
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
  assert.equal((replacement.match(/serviceKey:/g) ?? []).length, 3);
  const buildModule = compact(readFileSync(join(output, 'index/interfaces/BuilderBuildModule.md'), 'utf8'));
  assert.match(buildModule, /options: ModuleOptions/);
  assert.match(buildModule, /readonly exportedServiceKeys:/);
});

test('compiler declarations retain final provider-source facade syntax', () => {
  const sourcePath = resolve(directory, '../../src/di-bag.ts');
  const source = ts.createSourceFile(
    sourcePath,
    readFileSync(sourcePath, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const declaration = source.statements.find(node =>
    ts.isInterfaceDeclaration(node) && node.name.text === 'DiBagApi');
  assert(declaration, 'missing source DiBagApi interface');
  const facadeText = compact(ts.createPrinter({ removeComments: true })
    .printNode(ts.EmitHint.Unspecified, declaration, source));
  assert.match(facadeText, /createProvider: typeof createProvider;/);
  assert.match(facadeText, /createProviderFromFunction: typeof createProviderFromFunction;/);
  assert.match(facadeText, /createProviderFromClass: typeof createProviderFromClass;/);
  assert.match(facadeText, /createProviderFromPlugin: CreateProviderFromPlugin;/);
  assert.match(facadeText, /createToken: typeof createToken;/);
});

test('plugin provider constructor remains a callable type alias', () => {
  assert.match(createProviderFromPlugin, /^# Type Alias: CreateProviderFromPlugin$/m);
  assert.match(compact(createProviderFromPlugin), /type CreateProviderFromPlugin = <const Dependencies extends readonly DependencyReference\[\], Service, ReturnKind extends PluginReturnKind>/);
});

test('documented parameter names carry no abbreviations', () => {
  assert.match(factoryContext, /pushDisposer\(this: void, disposer: \(this: void, disposerContext: DisposerContext\) => void \| Promise<void>\): void;/);
  assert.match(compact(contextualFactory), /\(this: void, dependencies: Parameters<F> extends \[\] \? \{\s?\} : Parameters<F>\[0\]\) => ReturnType<F>;/);
  for (const page of [facade, container, builder, factoryContext, contextualFactory]) assert.doesNotMatch(page, /\b(?:factoryCtx|disposerCtx|deps)\b/);
});

test('callback parameters in public signatures are named by role', () => {
  const facadeText = compact(facade);
  assert.match(facadeText, /disposeService: \(this: void, service: ProviderAcquiredValue<NoInfer<ServiceProvider>>\) => void \| Promise<void>/);
  assert.match(facadeText, /Transform extends \(this: void, service: NoInfer<CallbackReceives> extends 'fulfilled-value' \? Awaited<ProviderOutput<NoInfer<ServiceProvider>>> : ProviderOutput<NoInfer<ServiceProvider>>\) =>/);
  assert.match(facadeText, /Transform extends \(this: void, service: ProviderOutput<NoInfer<ServiceProvider>>\) =>/);
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

test('requirement renaming publishes both labeled keys', () => {
  const text = compact(moduleInterface);
  assert.match(text, /withRenamedRequirement<const CurrentRequirementKey extends string, const NewRequirementKey extends string>/);
  assert.match(text, /currentRequirementKey: CurrentRequirementKey/);
  assert.match(text, /newRequirementKey: NewRequirementKey/);
});

test('provider-source reference pages render final members', () => {
  const facadeText = compact(facade);
  for (const text of ['createProvider:', 'createProviderFromFunction:', 'createProviderFromClass:', 'createProviderFromPlugin:', 'createToken:',
    'providerWithDisposal:', 'providerWithLifetime:', 'providerWithRegistrationMetadata:', 'providerWithAcquisitionMetadata:', 'providerWithTransformedService:']) {
    assert.ok(facadeText.includes(text), `missing facade rendering: ${text}`);
  }
  assert.doesNotMatch(provider, /withDisposal\(|withLifetime\(|withRegistrationMetadata\(|withAcquisitionMetadata\(|withTransformedService\(/);
  assert.match(facadeText, /Return a provider with singleton, scoped, or transient caching\. Providers are scoped per container by default; mark shared clients singleton when none of their dependencies are scoped\./);
  assert.match(facadeText, /DI_BAG_INVALID_ARGUMENT/);
  assert.match(compact(container), /DI_BAG_SINGLETON_REPLACEMENT/);
  assert.match(container, /lifetime: 'scoped:one-per-container'/);
  assert.match(compact(bindingSnapshot), /readonly factoryReturnKind: FactoryReturnKind;/);
  assert.match(compact(factoryContext), /readonly abortSignal: AbortSignal;/);
});
