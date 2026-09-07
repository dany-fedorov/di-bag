import { DiBag, type ProviderAcquired, type ProviderOutput, type ProviderTokenNeeds, type ModuleRequires } from '../../src';
import type { Assert, Equal } from './assert';
export const portKey = Symbol('port');
export const port = DiBag.token(portKey).of<number>();
export class Client {
  #value: number;
  constructor(readonly port: number) { this.#value = port; }
  read() { return this.#value; }
}
export const source = DiBag.fromClass([port], Client);
export const fn = DiBag.fromFunction([port], value => ({ port: value, literal: true as const }));
export const native = DiBag.fromFunction([], () => Promise.resolve({ id: 1 }), { acquisition: 'native' });
export const raw = DiBag.fromFunction([], () => Promise.resolve({ id: 1 }), { acquisition: 'raw' });
export const feature = DiBag.module().add({ source, fn }).exports(['source', 'fn']);
export const builder = DiBag.begin().install(feature);
export const bag = builder.bind(port, () => 8080).end();
const value = bag.resolve('source');
export type Exact = [Assert<Equal<typeof value, Client>>, Assert<Equal<ProviderOutput<typeof source>, Client>>,
  Assert<Equal<ProviderAcquired<typeof source>, Client>>, Assert<Equal<ProviderTokenNeeds<typeof source>, typeof port>>,
  Assert<Equal<ProviderOutput<typeof fn>, { port: number; literal: true }>>,
  Assert<Equal<ProviderOutput<typeof native>, Promise<{ id: number }>>>, Assert<Equal<ProviderAcquired<typeof native>, { id: number }>>,
  Assert<Equal<ProviderAcquired<typeof raw>, Promise<{ id: number }>>>,
  Assert<Equal<ModuleRequires<typeof feature>, Readonly<{ [portKey]: number }>>>];
class Optional { constructor(readonly value?: number) {} }
class Rest { constructor(readonly value: number, ...rest: number[]) { void rest; } }
class Empty {}
class Promised extends Promise<number> { constructor() { super(resolve => resolve(1)); } }
export const promisedClass = DiBag.fromClass([], Promised, { acquisition: 'native' });
export const rawClass = DiBag.fromClass([], Promised, { acquisition: 'raw' });
export type ClassModes = [Assert<Equal<ProviderOutput<typeof promisedClass>, Promised>>,
  Assert<Equal<ProviderAcquired<typeof promisedClass>, number>>, Assert<Equal<ProviderAcquired<typeof rawClass>, Promised>>];
DiBag.fromClass([], Empty); DiBag.fromClass([], Optional); DiBag.fromClass([port], Optional);
DiBag.fromClass([port], Rest); DiBag.fromClass([port, port, port], Rest);
DiBag.fromFunction([], (value?: number) => value); DiBag.fromFunction([port], (value?: number) => value);
DiBag.fromFunction([port, port], (...values: number[]) => values);
const receiver = { value: 1, read(this: { value: number }, port: number) { return this.value + port; } };
DiBag.fromFunction([port], receiver.read.bind(receiver));
// Existing fromTokens callbacks may intentionally ignore selected arguments.
DiBag.fromTokens([port], () => 1);
const promiseKey = Symbol('promise'); const promise = DiBag.token(promiseKey).of<Promise<number>>();
export const positional = DiBag.fromFunction([port, promise], (value, pending) => ({ value, pending }));
export type Positional = Assert<Equal<ProviderOutput<typeof positional>, { value: number; pending: Promise<number> }>>;
const defaults = (first = 1, second = 'fallback') => ({ first, second });
const defaultSource = DiBag.fromFunction([], defaults);
const selectedDefault = DiBag.fromFunction([port], (value = 1) => value);
export type Defaults = [Assert<Equal<ProviderOutput<typeof defaultSource>, { first: number; second: string }>>,
  Assert<Equal<ProviderOutput<typeof selectedDefault>, number>>];
export const inlineDefault = DiBag.fromFunction([], (value = 3) => value);
export const trailingDefault = DiBag.fromFunction([port], (selected, value = 3) => selected + value);
export const mixedDefaults = DiBag.fromFunction([port, promise], (selected, pending, value = 3) => ({ selected, pending, value }));
export type InlineDefaults = [Assert<Equal<ProviderOutput<typeof inlineDefault>, number>>,
  Assert<Equal<ProviderOutput<typeof trailingDefault>, number>>,
  Assert<Equal<ProviderOutput<typeof mixedDefaults>, { selected: number; pending: Promise<number>; value: number }>>];
