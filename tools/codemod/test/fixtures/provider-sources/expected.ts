import { DiBag } from 'di-bag';
import type { FactoryContext, FactoryReturnKind, PositionalFactoryArguments, PositionalFactoryFunction, PluginReturnKind, CreateProviderFromPluginOptions, CreateProviderFromPlugin } from 'di-bag';

const clockSymbol = Symbol('clock'); const itemsSymbol = Symbol('items');
const clock = DiBag.createToken(clockSymbol).forService<{ now(): number }>();
const items = DiBag.createToken(itemsSymbol).forCollectionOf<number>();
const query = DiBag.createProvider(() => ({ then() {} }), { factoryReturnKind: 'uninspected' });
const automatic = DiBag.createProvider(() => 1, { factoryReturnKind: 'auto-detect', factoryReceivesContext: true });
const sync = DiBag.createProvider((_dependencies: {}, context) => context.abortSignal.aborted, { factoryReturnKind: 'sync-value', factoryReceivesContext: true });
const asyncValue = DiBag.createProvider(async () => 1, { factoryReturnKind: 'native-promise' });
const positional = DiBag.createProviderFromFunction({ dependencies: [clock], factoryFunction: value => Promise.resolve(value.now()), factoryReturnKind: 'native-promise' });
const constructed = DiBag.createProviderFromClass({ dependencies: [clock], serviceClass: class Service { constructor(readonly clock: { now(): number }) {} } });
const plugin = DiBag.createProviderFromPlugin({ dependencies: [clock], pluginDescriptor: { apiVersion: 1, create: () => ({ run() {} }) }, factoryReturnKind: 'uninspected', isValidPluginOutput: (value): value is { run(): void } => typeof value === 'object' && value !== null });

const shared = { acquisitionMode: 'raw' as const };
const manualFactory = DiBag.fromFactory(() => 2, shared);
const manualFunction = DiBag.fromFunction([clock], value => value.now(), shared);
const spread = DiBag.fromPlugin([clock], {}, { ...shared, validate: (value): value is number => typeof value === 'number' });
export const snapshot = DiBag.createBuilder().withServices({ query }).buildContainer().graphSnapshot().bindings[0]!.factoryReturnKind;
export type Names = [FactoryContext, FactoryReturnKind, PositionalFactoryArguments<[], []>, PositionalFactoryFunction<[]>, PluginReturnKind, CreateProviderFromPluginOptions<'uninspected', number>, CreateProviderFromPlugin];
export type GenericOptions<ReturnKind extends PluginReturnKind> = CreateProviderFromPluginOptions<ReturnKind, number>;
void [items, automatic, sync, asyncValue, positional, constructed, plugin, manualFactory, manualFunction, spread];
