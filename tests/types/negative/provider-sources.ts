import { DiBag } from '../../../src';

const thenable = { then(_resolve: (value: number) => void) {} };
// diagnostic: factory output is a structural thenable; return a native Promise or select factoryReturnKind 'uninspected' or 'native-promise'
DiBag.createProvider(() => thenable);
DiBag.createProvider(async () => 1, {
  // diagnostic: sync-value output must not be a Promise or thenable
  factoryReturnKind: 'sync-value',
});
DiBag.createProvider(() => thenable, {
  // diagnostic: sync-value output must not be a Promise or thenable
  factoryReturnKind: 'sync-value',
});
DiBag.createProvider(() => 1, {
  // diagnostic: native-promise factory return kind requires a Promise output
  factoryReturnKind: 'native-promise',
});
DiBag.createProvider(() => 1, {
  // diagnostic: not assignable
  factoryReturnKind: 'raw',
});
DiBag.createProvider(() => 1, {
  // diagnostic: not assignable
  factoryReceivesContext: false,
});
// diagnostic: not assignable
DiBag.createProvider(function (this: { id: number }) { return this.id; });
// diagnostic: Types of property 'abortSignal' are incompatible
// diagnostic-native-gap: last-provider-context-shape
DiBag.createProvider((_dependencies: {}, factoryContext: { readonly abortSignal: string }) => factoryContext, { factoryReceivesContext: true });
// diagnostic: Target signature provides too few arguments. Expected 2 or more, but got 1.
// diagnostic-also: TS7006 Parameter 'factoryContext' implicitly has an 'any' type.
DiBag.createProvider((_dependencies: {}, factoryContext) => factoryContext.abortSignal);

// diagnostic: native-promise factory return kind requires a Promise output
// diagnostic-native-gap: last-provider-contextual-native-number
DiBag.createProvider((_dependencies: {}, _factoryContext) => 1, {
  factoryReceivesContext: true,
  factoryReturnKind: 'native-promise',
});
// diagnostic: sync-value output must not be a Promise or thenable
// diagnostic-native-gap: last-provider-contextual-sync-promise
DiBag.createProvider((_dependencies: {}, _factoryContext) => Promise.resolve(1), {
  factoryReceivesContext: true,
  factoryReturnKind: 'sync-value',
});
const contextualThenable = { then(_resolve: (value: number) => void) {} };
// diagnostic: factory output is a structural thenable; return a native Promise or select factoryReturnKind 'uninspected' or 'native-promise'
// diagnostic-native-gap: last-provider-contextual-thenable
DiBag.createProvider((_dependencies: {}, _factoryContext) => contextualThenable, { factoryReceivesContext: true });

const portSymbol = Symbol('port');
const port = DiBag.createToken(portSymbol).forService<number>();
declare const broad: readonly typeof port[];

DiBag.createProviderFromFunction({
  // diagnostic: finite tuple
  dependencies: broad,
  factoryFunction: (...values: number[]) => values,
});
DiBag.createProviderFromFunction<readonly [typeof port], (value: number) => number, 'native-promise'>({
  dependencies: [port],
  factoryFunction: value => value,
  // diagnostic: native-promise factory return kind requires a Promise output
  factoryReturnKind: 'native-promise',
});
DiBag.createProviderFromFunction({
  dependencies: [port],
  // diagnostic: Type 'number' is not assignable to type 'string'
  factoryFunction: (value: string) => value,
});
DiBag.createProviderFromFunction({
  dependencies: [port],
  factoryReceivesContext: true,
  // diagnostic: arguments must match the declared parameter tuple
  factoryFunction: (value: number) => value,
});
DiBag.createProviderFromFunction({
  dependencies: [port],
  factoryFunction: value => value,
  // diagnostic: native-promise factory return kind requires a Promise output
  factoryReturnKind: 'native-promise',
});
DiBag.createProviderFromClass({
  dependencies: [port],
  // diagnostic: not assignable
  serviceClass: class { constructor(_value: string) {} },
});
DiBag.createProviderFromClass({
  dependencies: [port],
  // diagnostic: Object literal may only specify known properties
  factoryReceivesContext: true,
  serviceClass: class { constructor(_value: number) {} },
});
DiBag.createProviderFromPlugin({
  dependencies: [],
  pluginDescriptor: {},
  // diagnostic: not assignable
  factoryReturnKind: 'auto-detect',
  isValidPluginOutput: (value: unknown): value is number => typeof value === 'number',
});
DiBag.createProviderFromPlugin({
  dependencies: [],
  pluginDescriptor: {},
  factoryReturnKind: 'uninspected',
  // diagnostic: not assignable
  isValidPluginOutput: (_value: unknown): boolean => true,
});

DiBag.createProviderFromFunction({
  dependencies: [port],
  // diagnostic: Type 'false' is not assignable to type 'never'
  factoryReceivesContext: false,
  factoryFunction: value => value,
});
// diagnostic: Property 'factoryReceivesContext' is missing
DiBag.createProviderFromFunction<readonly [typeof port], (value: number, context: import('../../../src').FactoryContext) => number, 'auto-detect', true>({
  dependencies: [port],
  factoryFunction: (value, _context) => value,
});
// diagnostic: Property 'factoryReturnKind' is missing
DiBag.createProviderFromFunction<readonly [typeof port], (value: number) => number, 'auto-detect' | 'native-promise'>({
  dependencies: [port],
  factoryFunction: value => value,
});
DiBag.createProviderFromFunction({
  dependencies: [port],
  // diagnostic: sync-value output must not be a Promise or thenable
  factoryFunction: value => Promise.resolve(value),
  factoryReturnKind: 'sync-value',
});
DiBag.createProviderFromFunction({
  dependencies: [port],
  factoryReceivesContext: true,
  factoryFunction: (value, _context) => value,
  // diagnostic: native-promise factory return kind requires a Promise output
  factoryReturnKind: 'native-promise',
});
DiBag.createProviderFromFunction({
  dependencies: [port],
  // diagnostic: factory output is a structural thenable
  factoryFunction: value => ({ then() {}, value }),
});
DiBag.createProviderFromFunction({
  dependencies: [port],
  // diagnostic: not assignable
  factoryFunction: function (this: { value: number }, value: number) { return value + this.value; },
});
DiBag.createProviderFromFunction({
  dependencies: [port, port],
  // diagnostic: positional factory arguments must match the declared parameter tuple
  factoryFunction: (value: number) => value,
});
DiBag.createProviderFromFunction({
  dependencies: [port],
  // diagnostic: Target signature provides too few arguments
  factoryFunction: (first: number, second: number) => first + second,
});

// diagnostic: token requires a singleton unique-symbol key
DiBag.createToken(Symbol('inline'));
declare const broadSymbol: symbol;
// diagnostic: token requires a singleton unique-symbol key
DiBag.createToken(broadSymbol);
const otherSymbol = Symbol('other');
declare const unionSymbol: typeof portSymbol | typeof otherSymbol;
// diagnostic: token requires a singleton unique-symbol key
DiBag.createToken(unionSymbol);
declare const impossibleSymbol: never;
// diagnostic: Expected 2 arguments, but got 1
DiBag.createToken<never>(impossibleSymbol);
