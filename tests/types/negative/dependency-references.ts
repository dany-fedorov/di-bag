import { DiBag, type Provider } from '../../../src';
import type { TokenBase } from '../../../src/tokens';
const key = Symbol('number'); const number = DiBag.token(key).of<number>();
const otherKey = Symbol('other'); const other = DiBag.token(otherKey).of<number>();
const wrong = DiBag.token(key).of<string>();
const optional = DiBag.optional(number); const lazy = DiBag.lazy(number);
const source = DiBag.fromFunction([optional], value => value);
const lazySource = DiBag.fromFunction([lazy], get => ({ get }));
// diagnostic: incompatible
DiBag.createBuilder().register(wrong, () => 'wrong').register({ source });
// diagnostic: incompatible
DiBag.createBuilder().register({ source }).register(wrong, () => 'wrong');
// diagnostic: incompatible
DiBag.createModuleBuilder().register(wrong, () => 'wrong').register({ source });
// diagnostic: incompatible
DiBag.createModuleBuilder().register({ source }).register(wrong, () => 'wrong');
// diagnostic: required service registrations are missing
DiBag.createBuilder().register({ lazySource }).build();
const feature = DiBag.createModuleBuilder().register({ source }).buildModule([]);
// diagnostic: consumer dependency
DiBag.createBuilder().register(wrong, () => 'wrong').installModule(feature);
// diagnostic: consumer dependency
DiBag.createBuilder().installModule(feature).register(wrong, () => 'wrong');
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
DiBag.createBuilder().register(optional, () => 1);
// diagnostic: not assignable
DiBag.createBuilder().register({ optional });
declare const broad: readonly typeof optional[];
declare const maybeTuple: readonly [typeof optional?];
declare const unionTuple: readonly [typeof optional] | readonly [typeof lazy];
// diagnostic: finite tuple
DiBag.fromFunction(broad, (...values: (number | undefined)[]) => values);
// diagnostic: not assignable
DiBag.fromClass(maybeTuple, class { constructor(value?: number) {} });
// diagnostic: finite tuple
DiBag.fromFunction(unionTuple, (value: number | undefined | (() => number)) => value);
// diagnostic: not assignable
DiBag.fromFunction([optional], (value: number) => value);
// diagnostic: not assignable
DiBag.fromFunction([lazy], (value: number) => value);
// diagnostic: arguments must match
DiBag.fromFunction([lazy], () => 1);
// diagnostic: not assignable
DiBag.fromFunction([lazy], function (this: { id: number }, get: () => number) { return get() + this.id; });
// diagnostic: not assignable
DiBag.fromFunction([optional], function (this: { id: number }, value) { return this.id; });
// diagnostic: not assignable
DiBag.fromClass([optional], class { constructor(value: number) {} });
// diagnostic: nativePromise acquisition requires a Promise output
DiBag.fromFunction([optional], value => value, { acquisitionMode: 'nativePromise' });
const root = DiBag.withLifetime(lazySource, 'root');
const rootOptional = DiBag.withLifetime(source, 'root');
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().register(number, () => 1).register({ root }).build();
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().register(number, () => 1).register({ rootOptional }).build();
const privateRoot = DiBag.createModuleBuilder().register({ rootOptional }).buildModule([]);
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().installModule(privateRoot).register(number, () => 1).build();
const privateLazy = DiBag.createModuleBuilder().register(number, () => 1).register({ root }).buildModule(['root']).renameExport('root', 'renamed');
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().installModule(privateLazy).build();
const valid = DiBag.createBuilder().register(number, DiBag.withLifetime(() => 1, 'root')).register({ root }).build();
// diagnostic: root lifetime cannot capture scoped dependency
valid.fork([number], { [key]: () => 2 });
// diagnostic: root lifetime cannot capture scoped dependency
valid.createScope([number, 'root'], { [key]: () => 2, root });
declare const erasedProvider: Provider<() => number> | typeof source;
// diagnostic: incompatible
DiBag.createBuilder().register(wrong, () => 'wrong').register({ source: erasedProvider });
const reflectedOptional: (...args: Parameters<typeof DiBag.optional>) => ReturnType<typeof DiBag.optional> = DiBag.optional;
const reflectedFunction: (...args: Parameters<typeof DiBag.fromFunction>) => ReturnType<typeof DiBag.fromFunction> = DiBag.fromFunction;
const reflectedClass: (...args: Parameters<typeof DiBag.fromClass>) => ReturnType<typeof DiBag.fromClass> = DiBag.fromClass;
// diagnostic: finite tuple
reflectedOptional(number);
// diagnostic: finite tuple
reflectedFunction([optional], value => value);
// diagnostic: finite tuple
reflectedClass([lazy], class { constructor(get: () => number) {} });
// diagnostic: not assignable
DiBag.fromFunction<readonly [typeof optional], (value: number) => number>([optional], value => value);
// diagnostic: nativePromise acquisition requires a Promise output
DiBag.fromFunction<readonly [typeof lazy], (get: () => number) => number, 'nativePromise'>([lazy], get => get(), { acquisitionMode: 'nativePromise' });
declare const referenceUnion: typeof optional | typeof lazy;
// diagnostic: not assignable
DiBag.fromFunction([referenceUnion], value => value);
// diagnostic: not assignable to type 'DependencyReference'
DiBag.fromFunction([{ ...optional }], value => value);
// diagnostic: not assignable
const invariant: import('../../../src').OptionalDependency<import('../../../src').Token<typeof key, number | string>> = optional;
const rootOptionalModule = DiBag.createModuleBuilder().register({ rootOptional }).buildModule(['rootOptional']).renameExport('rootOptional', 'renamed');
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().installModule(rootOptionalModule).register(number, () => 1).build();
const bound = DiBag.createBuilder().register(number, () => 1).register({ source }).build();
// diagnostic: token binding output
DiBag.createBuilder().register(number, () => 1).register({ source }).replace(number, () => 'wrong');
// diagnostic: not assignable
bound.fork([number], { [key]: () => 'wrong' });
// diagnostic: not assignable
bound.createScope([number], { [key]: () => 'wrong' });

declare const impossible: never;
// diagnostic: finite tuple
DiBag.fromFunction([impossible], value => value);
// diagnostic: finite tuple
DiBag.fromFunction<readonly [never], (value: never) => number>([impossible], value => 1);
