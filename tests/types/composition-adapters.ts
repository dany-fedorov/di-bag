import { DiBag, type ProviderAcquiredValue, type ProviderOutput, type ProviderRequiredTokens, type ModuleRequiredServices } from '../../src';
import type { Assert, Equal } from './assert';
export const portKey = Symbol('port');
export const port = DiBag.createToken(portKey).forService<number>();
export class Client {
  #value: number;
  constructor(readonly port: number) { this.#value = port; }
  read() { return this.#value; }
}
export const source = DiBag.createProviderFromClass({ dependencies: [port], serviceClass: Client });
export const fn = DiBag.createProviderFromFunction({ dependencies: [port], factoryFunction: value => ({ port: value, literal: true as const }) });
export const native = DiBag.createProviderFromFunction({ dependencies: [], factoryFunction: () => Promise.resolve({ id: 1 }), factoryReturnKind: 'native-promise' });
export const raw = DiBag.createProviderFromFunction({ dependencies: [], factoryFunction: () => Promise.resolve({ id: 1 }), factoryReturnKind: 'uninspected' });
export const feature = DiBag.createBuilder().withServices({ source, fn }).buildModule({ exportedServiceKeys: ['source', 'fn'] });
export const builder = DiBag.createBuilder().withInstalledModules([feature]);
export const bag = builder.withTokenService(port, () => 8080).buildContainer();
const value = bag.resolve('source');
export type Exact = [Assert<Equal<typeof value, Client>>, Assert<Equal<ProviderOutput<typeof source>, Client>>,
  Assert<Equal<ProviderAcquiredValue<typeof source>, Client>>, Assert<Equal<ProviderRequiredTokens<typeof source>, typeof port>>,
  Assert<Equal<ProviderOutput<typeof fn>, { port: number; literal: true }>>,
  Assert<Equal<ProviderOutput<typeof native>, Promise<{ id: number }>>>, Assert<Equal<ProviderAcquiredValue<typeof native>, { id: number }>>,
  Assert<Equal<ProviderAcquiredValue<typeof raw>, Promise<{ id: number }>>>,
  Assert<Equal<ModuleRequiredServices<typeof feature>, Readonly<{ [portKey]: number }>>>];
class Optional { constructor(readonly value?: number) {} }
class Rest { constructor(readonly value: number, ...rest: number[]) { void rest; } }
class Empty {}
class Promised extends Promise<number> { constructor() { super(resolve => resolve(1)); } }
export const promisedClass = DiBag.createProviderFromClass({ dependencies: [], serviceClass: Promised, factoryReturnKind: 'native-promise' });
export const rawClass = DiBag.createProviderFromClass({ dependencies: [], serviceClass: Promised, factoryReturnKind: 'uninspected' });
export type ClassModes = [Assert<Equal<ProviderOutput<typeof promisedClass>, Promised>>,
  Assert<Equal<ProviderAcquiredValue<typeof promisedClass>, number>>, Assert<Equal<ProviderAcquiredValue<typeof rawClass>, Promised>>];
DiBag.createProviderFromClass({ dependencies: [], serviceClass: Empty }); DiBag.createProviderFromClass({ dependencies: [], serviceClass: Optional }); DiBag.createProviderFromClass({ dependencies: [port], serviceClass: Optional });
DiBag.createProviderFromClass({ dependencies: [port], serviceClass: Rest }); DiBag.createProviderFromClass({ dependencies: [port, port, port], serviceClass: Rest });
DiBag.createProviderFromFunction({ dependencies: [], factoryFunction: (value?: number) => value }); DiBag.createProviderFromFunction({ dependencies: [port], factoryFunction: (value?: number) => value });
DiBag.createProviderFromFunction({ dependencies: [port, port], factoryFunction: (...values: number[]) => values });
const receiver = { value: 1, read(this: { value: number }, port: number) { return this.value + port; } };
DiBag.createProviderFromFunction({ dependencies: [port], factoryFunction: receiver.read.bind(receiver) });
// Existing fromFunction callbacks may intentionally ignore selected arguments.
DiBag.createProviderFromFunction({ dependencies: [port], factoryFunction: (_dependency0) => 1 });
const promiseKey = Symbol('promise'); const promise = DiBag.createToken(promiseKey).forService<Promise<number>>();
export const positional = DiBag.createProviderFromFunction({ dependencies: [port, promise], factoryFunction: (value, pending) => ({ value, pending }) });
export type Positional = Assert<Equal<ProviderOutput<typeof positional>, { value: number; pending: Promise<number> }>>;
const defaults = (first = 1, second = 'fallback') => ({ first, second });
const defaultSource = DiBag.createProviderFromFunction({ dependencies: [], factoryFunction: defaults });
const selectedDefault = DiBag.createProviderFromFunction({ dependencies: [port], factoryFunction: (value = 1) => value });
export type Defaults = [Assert<Equal<ProviderOutput<typeof defaultSource>, { first: number; second: string }>>,
  Assert<Equal<ProviderOutput<typeof selectedDefault>, number>>];
export const inlineDefault = DiBag.createProviderFromFunction({ dependencies: [], factoryFunction: (value = 3) => value });
export const trailingDefault = DiBag.createProviderFromFunction({ dependencies: [port], factoryFunction: (selected, value = 3) => selected + value });
export const mixedDefaults = DiBag.createProviderFromFunction({ dependencies: [port, promise], factoryFunction: (selected, pending, value = 3) => ({ selected, pending, value }) });
export type InlineDefaults = [Assert<Equal<ProviderOutput<typeof inlineDefault>, number>>,
  Assert<Equal<ProviderOutput<typeof trailingDefault>, number>>,
  Assert<Equal<ProviderOutput<typeof mixedDefaults>, { selected: number; pending: Promise<number>; value: number }>>];
