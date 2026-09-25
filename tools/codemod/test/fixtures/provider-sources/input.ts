import { DiBag } from 'di-bag';
import type { AcquisitionContext, AcquisitionMode, CompositionArguments, CompositionFunction, PluginAcquisitionMode, PluginOptions, PluginProviderFactory } from 'di-bag';

const clockSymbol = Symbol('clock'); const itemsSymbol = Symbol('items');
const clock = DiBag.token(clockSymbol).of<{ now(): number }>();
const items = DiBag.token(itemsSymbol).of<number>();
const query = DiBag.fromFactory(() => ({ then() {} }), { acquisitionMode: 'raw' });
const automatic = DiBag.fromFactory(() => 1, { acquisitionMode: 'auto', context: 'acquisition' });
const sync = DiBag.fromSyncFactory((_dependencies: {}, context) => context.signal.aborted, { context: 'acquisition' });
const asyncValue = DiBag.fromAsyncFactory(async () => 1);
const positional = DiBag.fromFunction([clock], value => Promise.resolve(value.now()), { acquisitionMode: 'nativePromise' });
const constructed = DiBag.fromClass([clock], class Service { constructor(readonly clock: { now(): number }) {} });
const plugin = DiBag.fromPlugin([clock], { apiVersion: 1, create: () => ({ run() {} }) }, {
  acquisitionMode: 'raw',
  validate: (value): value is { run(): void } => typeof value === 'object' && value !== null,
});

const shared = { acquisitionMode: 'raw' as const };
const manualFactory = DiBag.fromFactory(() => 2, shared);
const manualFunction = DiBag.fromFunction([clock], value => value.now(), shared);
const spread = DiBag.fromPlugin([clock], {}, { ...shared, validate: (value): value is number => typeof value === 'number' });
export const snapshot = DiBag.createBuilder().register({ query }).build().inspectGraph().bindings[0]!.acquisitionMode;
export type Names = [AcquisitionContext, AcquisitionMode, CompositionArguments<[], []>, CompositionFunction<[]>, PluginAcquisitionMode, PluginOptions<'raw', number>, PluginProviderFactory];
export type GenericOptions<ReturnKind extends PluginAcquisitionMode> = PluginOptions<ReturnKind, number>;
void [DiBag.all(items), automatic, sync, asyncValue, positional, constructed, plugin, manualFactory, manualFunction, spread];
