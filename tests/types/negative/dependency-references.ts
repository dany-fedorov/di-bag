import { DiBag, type Provider } from '../../../src';
import type { TokenBase } from '../../../src/tokens';
const key = Symbol('number'); const number = DiBag.createToken(key).forService<number>();
const otherKey = Symbol('other'); const other = DiBag.createToken(otherKey).forService<number>();
const wrong = DiBag.createToken(key).forService<string>();
const optional = DiBag.optional(number); const lazy = DiBag.lazy(number);
const source = DiBag.createProviderFromFunction({ dependencies: [optional], factoryFunction: value => value });
const lazySource = DiBag.createProviderFromFunction({ dependencies: [lazy], factoryFunction: get => ({ get }) });
// diagnostic: incompatible
DiBag.createBuilder().withTokenService(wrong, () => 'wrong').withServices({ source });
// diagnostic: incompatible
DiBag.createBuilder().withServices({ source }).withTokenService(wrong, () => 'wrong');
// diagnostic: incompatible
DiBag.createBuilder().withTokenService(wrong, () => 'wrong').withServices({ source });
// diagnostic: incompatible
DiBag.createBuilder().withServices({ source }).withTokenService(wrong, () => 'wrong');
// diagnostic: required service registrations are missing
DiBag.createBuilder().withServices({ lazySource }).buildContainer();
const feature = DiBag.createBuilder().withServices({ source }).buildModule({ exportedServiceKeys: [] });
// diagnostic: consumer dependency
DiBag.createBuilder().withTokenService(wrong, () => 'wrong').withInstalledModules([feature]);
// diagnostic: consumer dependency
DiBag.createBuilder().withInstalledModules([feature]).withTokenService(wrong, () => 'wrong');
// diagnostic: not assignable
DiBag.optional(optional);
// diagnostic: not assignable
DiBag.lazy(lazy);
// diagnostic: not assignable
DiBag.lazy(optional);
// diagnostic: not assignable
DiBag.optional(lazy);
// diagnostic: known properties
DiBag.optional({ key });
declare const erased: TokenBase;
declare const union: typeof number | typeof other;
// diagnostic: finite tuple
DiBag.optional(erased);
// diagnostic: finite tuple
DiBag.lazy(union);
// diagnostic: finite tuple
DiBag.optional<typeof union>(number);
// diagnostic: Expected 2 arguments
DiBag.lazy<never>(number as never);
// diagnostic: not assignable
DiBag.createBuilder().withTokenService(optional, () => 1);
// diagnostic: not assignable
DiBag.createBuilder().withServices({ optional });
declare const broad: readonly typeof optional[];
declare const maybeTuple: readonly [typeof optional?];
declare const unionTuple: readonly [typeof optional] | readonly [typeof lazy];
// diagnostic: finite tuple
DiBag.createProviderFromFunction({ dependencies: broad, factoryFunction: (...values: (number | undefined)[]) => values });
// diagnostic: not assignable
DiBag.createProviderFromClass({ dependencies: maybeTuple, serviceClass: class { constructor(value?: number) {} } });
// diagnostic: finite tuple
DiBag.createProviderFromFunction({ dependencies: unionTuple, factoryFunction: (value: number | undefined | (() => number)) => value });
// diagnostic: not assignable
DiBag.createProviderFromFunction({ dependencies: [optional], factoryFunction: (value: number) => value });
// diagnostic: not assignable
DiBag.createProviderFromFunction({ dependencies: [lazy], factoryFunction: (value: number) => value });
// diagnostic: arguments must match
DiBag.createProviderFromFunction({ dependencies: [lazy], factoryFunction: () => 1 });
// diagnostic: not assignable
DiBag.createProviderFromFunction({ dependencies: [lazy], factoryFunction: function (this: { id: number }, get: () => number) { return get() + this.id; } });
// diagnostic: not assignable
DiBag.createProviderFromFunction({ dependencies: [optional], factoryFunction: function (this: { id: number }, value) { return this.id; } });
// diagnostic: not assignable
DiBag.createProviderFromClass({ dependencies: [optional], serviceClass: class { constructor(value: number) {} } });
// diagnostic: native-promise factory return kind requires a Promise output
DiBag.createProviderFromFunction({ dependencies: [optional], factoryFunction: value => value, factoryReturnKind: 'native-promise' });
const root = DiBag.withLifetime(lazySource, 'root');
const rootOptional = DiBag.withLifetime(source, 'root');
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().withTokenService(number, () => 1).withServices({ root }).buildContainer();
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().withTokenService(number, () => 1).withServices({ rootOptional }).buildContainer();
const privateRoot = DiBag.createBuilder().withServices({ rootOptional }).buildModule({ exportedServiceKeys: [] });
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().withInstalledModules([privateRoot]).withTokenService(number, () => 1).buildContainer();
const privateLazy = DiBag.createBuilder().withTokenService(number, () => 1).withServices({ root }).buildModule({ exportedServiceKeys: ['root'] }).withRenamedExport({ currentExportKey: 'root', newExportKey: 'renamed' });
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().withInstalledModules([privateLazy]).buildContainer();
const valid = DiBag.createBuilder().withTokenService(number, DiBag.withLifetime(() => 1, 'root')).withServices({ root }).buildContainer();
// diagnostic: root lifetime cannot capture scoped dependency
valid.createIndependentContainer([number], { [key]: () => 2 });
// diagnostic: root lifetime cannot capture scoped dependency
valid.createChildContainer([number, 'root'], { [key]: () => 2, root });
declare const erasedProvider: Provider<() => number> | typeof source;
// diagnostic: incompatible
DiBag.createBuilder().withTokenService(wrong, () => 'wrong').withServices({ source: erasedProvider });
const reflectedOptional: (...args: Parameters<typeof DiBag.optional>) => ReturnType<typeof DiBag.optional> = DiBag.optional;
const reflectedFunction: (...args: Parameters<typeof DiBag.createProviderFromFunction>) => ReturnType<typeof DiBag.createProviderFromFunction> = DiBag.createProviderFromFunction;
const reflectedClass: (...args: Parameters<typeof DiBag.createProviderFromClass>) => ReturnType<typeof DiBag.createProviderFromClass> = DiBag.createProviderFromClass;
// diagnostic: finite tuple
reflectedOptional(number);
// diagnostic: not assignable to parameter of type 'never'
// diagnostic-also: TS7006 Parameter 'value' implicitly has an 'any' type.
reflectedFunction({ dependencies: [optional], factoryFunction: value => value });
// diagnostic: finite tuple
// diagnostic-also: TS2322 Target requires 1 element(s) but source may have fewer.
reflectedClass({ dependencies: [lazy], serviceClass: class { constructor(get: () => number) {} } });
// diagnostic: not assignable
DiBag.createProviderFromFunction<readonly [typeof optional], (value: number) => number>({ dependencies: [optional], factoryFunction: value => value });
// diagnostic: native-promise factory return kind requires a Promise output
DiBag.createProviderFromFunction<readonly [typeof lazy], (get: () => number) => number, 'native-promise'>({ dependencies: [lazy], factoryFunction: get => get(), factoryReturnKind: 'native-promise' });
declare const referenceUnion: typeof optional | typeof lazy;
// diagnostic: not assignable
DiBag.createProviderFromFunction({ dependencies: [referenceUnion], factoryFunction: value => value });
// diagnostic: not assignable to type 'DependencyReference'
DiBag.createProviderFromFunction({ dependencies: [{ ...optional }], factoryFunction: value => value });
// diagnostic: not assignable
const invariant: import('../../../src').OptionalDependency<import('../../../src').Token<typeof key, number | string>> = optional;
const rootOptionalModule = DiBag.createBuilder().withServices({ rootOptional }).buildModule({ exportedServiceKeys: ['rootOptional'] }).withRenamedExport({ currentExportKey: 'rootOptional', newExportKey: 'renamed' });
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().withInstalledModules([rootOptionalModule]).withTokenService(number, () => 1).buildContainer();
const bound = DiBag.createBuilder().withTokenService(number, () => 1).withServices({ source }).buildContainer();
// diagnostic: token binding output
DiBag.createBuilder().withTokenService(number, () => 1).withServices({ source }).withReplacedService(number, () => 'wrong');
// diagnostic: not assignable
bound.createIndependentContainer([number], { [key]: () => 'wrong' });
// diagnostic: not assignable
bound.createChildContainer([number], { [key]: () => 'wrong' });

declare const impossible: never;
// diagnostic: finite tuple
DiBag.createProviderFromFunction({ dependencies: [impossible], factoryFunction: value => value });
// diagnostic: finite tuple
DiBag.createProviderFromFunction<readonly [never], (value: never) => number>({ dependencies: [impossible], factoryFunction: value => 1 });
