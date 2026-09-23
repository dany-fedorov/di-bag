import { DiBag } from '../../src';
import type { FactoryContext, FactoryReturnKind, ProviderAcquiredValue, ProviderNamedDependencies, ProviderOutput } from '../../src';
import type { Assert, Equal } from './assert';

const pending = Promise.resolve({ id: 1 });
export const automatic = DiBag.createProvider(async () => ({ id: 1 }));
export const synchronous = DiBag.createProvider(() => ({ id: 1 }), { factoryReturnKind: 'sync-value' });
export const uninspected = DiBag.createProvider(() => pending, { factoryReturnKind: 'uninspected' });
export const native = DiBag.createProvider(() => pending, { factoryReturnKind: 'native-promise' });
export const contextual = DiBag.createProvider((_dependencies: { port: number }, factoryContext) => {
  const exact: FactoryContext = factoryContext;
  const signal: AbortSignal = exact.abortSignal;
  return { signal };
}, { factoryReceivesContext: true, factoryReturnKind: 'sync-value' });
const disposerOnly = DiBag.createProvider((_dependencies: {}, factoryContext: Pick<FactoryContext, 'pushDisposer'>) => {
  factoryContext.pushDisposer(() => {});
  return 1;
}, { factoryReceivesContext: true, factoryReturnKind: 'sync-value' });
export const contextualNative = DiBag.createProvider((_dependencies: { port: number }, factoryContext) =>
  Promise.resolve(factoryContext.abortSignal), { factoryReceivesContext: true, factoryReturnKind: 'native-promise' });

export type Exact = [
  Assert<Equal<FactoryReturnKind, 'auto-detect' | 'sync-value' | 'native-promise' | 'uninspected'>>,
  Assert<Equal<ProviderOutput<typeof automatic>, Promise<{ id: number }>>>,
  Assert<Equal<ProviderAcquiredValue<typeof automatic>, { id: number }>>,
  Assert<Equal<ProviderOutput<typeof synchronous>, { id: number }>>,
  Assert<Equal<ProviderOutput<typeof uninspected>, Promise<{ id: number }>>>,
  Assert<Equal<ProviderAcquiredValue<typeof uninspected>, Promise<{ id: number }>>>,
  Assert<Equal<ProviderOutput<typeof native>, Promise<{ id: number }>>>,
  Assert<Equal<ProviderAcquiredValue<typeof native>, { id: number }>>,
  Assert<Equal<ProviderOutput<typeof contextual>, { signal: AbortSignal }>>,
  Assert<Equal<ProviderOutput<typeof contextualNative>, Promise<AbortSignal>>>,
  Assert<Equal<ProviderAcquiredValue<typeof contextualNative>, AbortSignal>>,
  Assert<Equal<ProviderNamedDependencies<typeof contextualNative>, { port: number }>>,
];

const portSymbol = Symbol('port');
const hostSymbol = Symbol('host');
const valuesSymbol = Symbol('values');
const port = DiBag.createToken(portSymbol).forService<number>();
const host = DiBag.createToken(hostSymbol).forService<string>();
const values = DiBag.createToken(valuesSymbol).forCollectionOf<number>();

export const inline = DiBag.createProviderFromFunction({
  dependencies: [port, DiBag.optional(host), DiBag.lazy(port), values],
  factoryFunction: (selected, maybe, get, all) => ({ selected, maybe, lazy: get(), all }),
});
const contextualPosition = DiBag.createProviderFromFunction({
  dependencies: [port],
  factoryReceivesContext: true,
  factoryFunction: (selected, factoryContext) => [selected, factoryContext.abortSignal] as const,
});
const defaulted = DiBag.createProviderFromFunction({ dependencies: [port], factoryFunction: (selected, extra = 3) => selected + extra });
const rested = DiBag.createProviderFromFunction({ dependencies: [port, port], factoryFunction: (first, ...rest) => first + rest[0] });
export const explicit = DiBag.createProviderFromFunction<
  readonly [typeof port],
  (value: number) => number,
  'sync-value'
>({ dependencies: [port], factoryFunction: value => value, factoryReturnKind: 'sync-value' });
class Client { constructor(readonly port: number, readonly host: string | undefined) {} }
const constructed = DiBag.createProviderFromClass({ dependencies: [port, DiBag.optional(host)], serviceClass: Client });
export const plugin = DiBag.createProviderFromPlugin({
  dependencies: [port],
  pluginDescriptor: {} as unknown,
  factoryReturnKind: 'uninspected',
  isValidPluginOutput: (value: unknown): value is { run(): void } => typeof value === 'object' && value !== null && 'run' in value,
});
const nativePosition = DiBag.createProviderFromFunction({
  dependencies: [port],
  factoryReceivesContext: true,
  factoryReturnKind: 'native-promise',
  factoryFunction: (value, factoryContext) => Promise.resolve([value, factoryContext.abortSignal] as const),
});
const zeroPosition = DiBag.createProviderFromFunction({ dependencies: [], factoryFunction: () => ({ id: 1 }) });
const reorderedPosition = DiBag.createProviderFromFunction({
  factoryFunction: (value, factoryContext) => [value, factoryContext.abortSignal] as const,
  factoryReceivesContext: true,
  dependencies: [port],
});
const uninspectedPosition = DiBag.createProviderFromFunction({
  dependencies: [port],
  factoryReturnKind: 'uninspected',
  factoryFunction: value => ({ then() {}, value }),
});

export type PositionalExact = [
  Assert<Equal<ProviderOutput<typeof inline>, { selected: number; maybe: string | undefined; lazy: number; all: readonly number[] }>>,
  Assert<Equal<ProviderOutput<typeof contextualPosition>, readonly [number, AbortSignal]>>,
  Assert<Equal<ProviderOutput<typeof defaulted>, number>>,
  Assert<Equal<ProviderOutput<typeof rested>, number>>,
  Assert<Equal<ProviderOutput<typeof explicit>, number>>,
  Assert<Equal<ProviderOutput<typeof constructed>, Client>>,
  Assert<Equal<ProviderOutput<typeof plugin>, { run(): void }>>,
  Assert<Equal<ProviderOutput<typeof nativePosition>, Promise<readonly [number, AbortSignal]>>>,
  Assert<Equal<ProviderAcquiredValue<typeof nativePosition>, readonly [number, AbortSignal]>>,
  Assert<Equal<ProviderOutput<typeof zeroPosition>, { id: number }>>,
  Assert<Equal<ProviderOutput<typeof reorderedPosition>, readonly [number, AbortSignal]>>,
  Assert<Equal<ProviderOutput<typeof uninspectedPosition>, { then(): void; value: number }>>,
];
