// Generates src/removed-api.ts from tools/codemod/rename-map.json: one throwing stub per callable name that 0.5.0 removed.
// Usage: node scripts/generate-removed-api.mjs [--map <file>] [--out <file>] [--check]
import { readFileSync, writeFileSync } from 'node:fs';

const option = name => { const index = process.argv.indexOf(name); return index === -1 ? undefined : process.argv[index + 1]; };
const mapFile = option('--map') ?? 'tools/codemod/rename-map.json';
const outFile = option('--out') ?? 'src/removed-api.ts';

// What to tell the caller when the new name alone would mislead, because the call moved to another object or split in two.
const replacementText = {
  'DiBagApi.token': 'DiBag.createToken(symbol).forService<Service>() or DiBag.createToken(symbol).forCollectionOf<Item>(); choose the kind manually from its uses, and split mixed single-service and collection uses into tokens with distinct symbols',
  'DiBagApi.all': 'the collection token itself, from DiBag.createToken(symbol).forCollectionOf<Item>()',
  'DiBagApi.fromFactory': "DiBag.createProvider(factory, options); rename acquisitionMode to factoryReturnKind (auto -> auto-detect, raw -> uninspected, nativePromise -> native-promise) and context: 'acquisition' to factoryReceivesContext: true; options may be omitted",
  'DiBagApi.fromSyncFactory': "DiBag.createProvider(factory, { factoryReturnKind: 'sync-value' }); add factoryReceivesContext: true if the old call used context: 'acquisition'",
  'DiBagApi.fromAsyncFactory': "DiBag.createProvider(factory, { factoryReturnKind: 'native-promise' }); add factoryReceivesContext: true if the old call used context: 'acquisition'",
  'DiBagApi.fromFunction': 'DiBag.createProviderFromFunction({ dependencies, factoryFunction }); move any acquisitionMode option into this object as factoryReturnKind (auto -> auto-detect, raw -> uninspected, nativePromise -> native-promise)',
  'DiBagApi.fromClass': 'DiBag.createProviderFromClass({ dependencies, serviceClass }); move any acquisitionMode option into this object as factoryReturnKind (auto -> auto-detect, raw -> uninspected, nativePromise -> native-promise)',
  'DiBagApi.fromPlugin': 'DiBag.createProviderFromPlugin({ dependencies, pluginDescriptor, factoryReturnKind, isValidPluginOutput }); rename validate to isValidPluginOutput and map acquisitionMode raw -> uninspected or nativePromise -> native-promise',
  'DiBagApi.withDisposal': 'DiBag.providerWithDisposal({ provider, disposeService })',
  'DiBagApi.withLifetime': 'DiBag.providerWithLifetime({ provider, lifetime }); map root -> singleton:one-per-container-tree, scoped -> scoped:one-per-container, or transient -> transient:one-per-resolve; move allowScopedDependencies into this object as allowsScopedDependencies',
  'DiBagApi.withMetadata': 'DiBag.providerWithRegistrationMetadata({ provider, registrationMetadata }) for static metadata, or DiBag.providerWithAcquisitionMetadata({ provider, describeAcquisition, callbackReceives }) for dynamic metadata; map mode direct -> exposed-service or awaited -> fulfilled-value; combined static and dynamic metadata requires manually composing both calls while preserving evaluation order',
  'DiBagApi.transformService': 'DiBag.providerWithTransformedService({ provider, transformService, callbackReceives }); map mode direct -> exposed-service or awaited -> fulfilled-value; for exposed-service callbacks, rename acquisitionMode to transformReturnKind (auto -> auto-detect, raw -> uninspected, nativePromise -> native-promise)',
  'Builder.alias': 'builder.withServiceAlias({ aliasKey, targetServiceKey })',
  'Builder.contribute': 'builder.withCollectionContribution({ collectionToken, provider }); create collectionToken with DiBag.createToken(symbol).forCollectionOf<Item>()',
  'Builder.installModule': 'builder.withInstalledModules([module])',
  'Builder.register': 'builder.withServices({ key: provider }) or builder.withTokenService(token, provider)',
  'Builder.buildAndStart': 'builder.buildContainer().ensureServicesReady(serviceKeys, options); rename signal to abortSignal and timeoutMs to totalTimeoutMs; replace startupOrder with maxConcurrentServiceKeys (omit for parallel, 1 for sequential, or the number); options may be omitted',
  'Bag.resolveAll': 'container.resolveCollection(collectionToken); create collectionToken with DiBag.createToken(symbol).forCollectionOf<Item>(), and manually split any mixed single-service and collection uses into tokens with distinct symbols',
  'Bag.inspectAll': 'container.serviceSnapshot(collectionToken); create collectionToken with DiBag.createToken(symbol).forCollectionOf<Item>(), and manually split any mixed single-service and collection uses into tokens with distinct symbols',
  'Bag.inspect': 'container.serviceSnapshot(serviceKey)',
  'Bag.inspectGraph': 'container.graphSnapshot()',
  'Bag.fork': 'container.createIndependentContainer(replacedServiceKeys, replacementProviders); use container.createIndependentContainer() when no services are replaced',
  'Bag.createScope': 'container.createChildContainer(replacedServiceKeys, replacementProviders, { sharedParentServiceKeys }); use container.createChildContainer() or container.createChildContainer({ sharedParentServiceKeys }) when no services are replaced',
  'Module.renameExport': 'module.withRenamedExport({ currentExportKey, newExportKey })',
  'token().of': 'DiBag.createToken(symbol).forService<Service>() or DiBag.createToken(symbol).forCollectionOf<Item>(); choose the kind manually from its uses, and split mixed single-service and collection uses into tokens with distinct symbols',
};
const receiver = { DiBagApi: 'DiBag.', Builder: 'builder.', Bag: 'container.', Module: 'module.', Provider: 'provider.' };

const map = JSON.parse(readFileSync(mapFile, 'utf8'));
const owners = new Map();
for (const entry of map.methods ?? []) {
  const moved = replacementText[`${entry.owner}.${entry.from}`];
  // Same name on both sides: only the arguments changed and the name is still live, UNLESS the table above says the call moved to another object.
  if (entry.from === entry.to && moved === undefined) continue;
  const replacement = moved ?? (entry.to === undefined ? entry.manual : `${receiver[entry.owner] ?? ''}${entry.to}`);
  if (typeof replacement !== 'string' || replacement === '') throw new Error(`methods: ${entry.owner}.${entry.from} has neither "to" nor "manual"`);
  if (!owners.has(entry.owner)) owners.set(entry.owner, new Map());
  owners.get(entry.owner).set(entry.from, replacement);
}
// A name that another entry of the same owner produces is live, so it must not get a stub.
for (const entry of map.methods ?? []) if (entry.from !== entry.to) owners.get(entry.owner)?.delete(entry.to);

const quote = text => JSON.stringify(text);
const table = [...owners].sort(([a], [b]) => a.localeCompare(b)).filter(([, names]) => names.size)
  .map(([owner, names]) => `  ${quote(owner)}: {\n${[...names].sort(([a], [b]) => a.localeCompare(b)).map(([name, text]) => `    ${quote(name)}: ${quote(text)},`).join('\n')}\n  },`).join('\n');

const text = `// GENERATED by scripts/generate-removed-api.mjs from tools/codemod/rename-map.json. Do not edit by hand.
import { libraryError } from './errors';

/** Every callable name that 0.5.0 removed, by the 0.4.0 declaration that owned it, with what replaces it. */
export const removedApi: Readonly<Record<string, Readonly<Record<string, string>>>> = Object.freeze({
${table}
});

const stubs = new WeakSet<object>();
/** True for a function that exists only to say that a 0.4.0 name is gone. */
export function isRemovedApiStub(value: unknown): boolean { return typeof value === 'function' && stubs.has(value); }

function stub(owner: string, name: string, replacement: string): () => never {
  const removedApiStub = (): never => {
    throw libraryError('DI_BAG_REMOVED_API', \`\${name} was removed in 0.5.0; use \${replacement}\`, { operation: name, removed: \`\${owner}.\${name}\`, replacement });
  };
  stubs.add(removedApiStub);
  return removedApiStub;
}

/**
 * Define the stubs of one owner on a class prototype, or on a plain object such as the facade BEFORE it is frozen.
 * A stub is not enumerable, so Object.keys(DiBag) lists only the live API, and it never replaces a member the target still has.
 */
export function installRemovedMembers(owner: string, target: object): void {
  for (const [name, replacement] of Object.entries(removedApi[owner] ?? {})) {
    if (name in target) continue;
    Object.defineProperty(target, name, { value: stub(owner, name, replacement), enumerable: false, configurable: false, writable: false });
  }
}
`;

if (process.argv.includes('--check')) {
  let current = '';
  try { current = readFileSync(outFile, 'utf8'); } catch { /* missing counts as stale */ }
  if (current !== text) { console.error(`${outFile} is stale: run node scripts/generate-removed-api.mjs`); process.exit(1); }
} else {
  writeFileSync(outFile, text);
  console.log(`${outFile}: ${[...owners.values()].reduce((sum, names) => sum + names.size, 0)} stubs for ${[...owners].filter(([, names]) => names.size).length} owners`);
}
