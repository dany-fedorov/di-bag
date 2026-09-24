import { DiBag } from '../../../src';
import type { ProviderOutput } from '../../../src';
import type { ProviderBase } from '../../../src/provider';

declare const unknownPlugin: unknown;
const valid = (value: unknown): value is { run(): number } => typeof value === 'object' && value !== null;
// diagnostic: not assignable
DiBag.createProviderFromPlugin({ dependencies: [], pluginDescriptor: unknownPlugin, factoryReturnKind: 'auto-detect', isValidPluginOutput: valid });
// diagnostic: Property 'factoryReturnKind' is missing
DiBag.createProviderFromPlugin({ dependencies: [], pluginDescriptor: unknownPlugin, isValidPluginOutput: valid });
// diagnostic: not assignable
DiBag.createProviderFromPlugin({ dependencies: [], pluginDescriptor: unknownPlugin, factoryReturnKind: 'uninspected', isValidPluginOutput: (value: unknown): boolean => typeof value === 'object' });
// diagnostic: not assignable
DiBag.createProviderFromPlugin({ dependencies: [], pluginDescriptor: unknownPlugin, factoryReturnKind: 'uninspected', isValidPluginOutput: function(this: { id: number }, value: unknown): value is { run(): number } { return this.id > 0 && typeof value === 'object'; } });
const key = Symbol('number'); const number = DiBag.createToken(key).forService<number>();
declare const broad: readonly [typeof number, ...typeof number[]];
// diagnostic: finite tuple
DiBag.createProviderFromPlugin({ dependencies: broad, pluginDescriptor: unknownPlugin, factoryReturnKind: 'uninspected', isValidPluginOutput: valid });
const requiredPlugin = DiBag.createProviderFromPlugin({ dependencies: [number], pluginDescriptor: unknownPlugin, factoryReturnKind: 'uninspected', isValidPluginOutput: valid });
// diagnostic: required service registrations are missing
DiBag.createBuilder().withServices({ requiredPlugin: DiBag.providerWithLifetime({ provider: requiredPlugin, lifetime: 'scoped:one-per-container' }) }).buildContainer();
const rootPlugin = DiBag.providerWithLifetime({ provider: requiredPlugin, lifetime: 'singleton:one-per-container-tree' });
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().withTokenService(number, DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'scoped:one-per-container' })).withServices({ rootPlugin }).buildContainer();
const raw = DiBag.createProviderFromPlugin({ dependencies: [], pluginDescriptor: unknownPlugin, factoryReturnKind: 'uninspected', isValidPluginOutput: valid });
const native = DiBag.createProviderFromPlugin({ dependencies: [], pluginDescriptor: unknownPlugin, factoryReturnKind: 'native-promise', isValidPluginOutput: valid });
// diagnostic: not assignable
DiBag.providerWithDisposal({ provider: raw, disposeService: (value: Promise<{ run(): number }>) => { void value; } });
// diagnostic: not assignable
DiBag.providerWithDisposal({ provider: native, disposeService: (value: Promise<{ run(): number }>) => { void value; } });
const privateFeature = DiBag.createBuilder().withTokenService(number, DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'scoped:one-per-container' })).withServices({ privatePlugin: DiBag.providerWithLifetime({ provider: requiredPlugin, lifetime: 'scoped:one-per-container' }) }).buildModule({ exportedServiceKeys: ['privatePlugin'] });
// diagnostic: not assignable
DiBag.createBuilder().withInstalledModules([privateFeature]).buildContainer().resolve(number);
declare const erased: ProviderBase;
declare const erasedOutput: ProviderOutput<typeof erased>;
// diagnostic: not assignable
const claimed: { run(): number } = erasedOutput;
