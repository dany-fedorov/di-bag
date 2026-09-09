import { DiBag, type Provider } from '../../../src';
import type { TokenBase } from '../../../src/tokens';
const key = Symbol('number'); const number = DiBag.token(key).of<number>();
const otherKey = Symbol('other'); const other = DiBag.token(otherKey).of<number>();
const wrong = DiBag.token(key).of<string>();
const optional = DiBag.optional(number); const lazy = DiBag.lazy(number);
const source = DiBag.fromFunction([optional], value => value);
const lazySource = DiBag.fromFunction([lazy], get => ({ get }));
// diagnostic: incompatible
DiBag.begin().bind(wrong, () => 'wrong').add({ source });
// diagnostic: incompatible
DiBag.begin().add({ source }).bind(wrong, () => 'wrong');
// diagnostic: incompatible
DiBag.module().bind(wrong, () => 'wrong').add({ source });
// diagnostic: incompatible
DiBag.module().add({ source }).bind(wrong, () => 'wrong');
// diagnostic: missing factories
DiBag.begin().add({ lazySource }).end();
const feature = DiBag.module().add({ source }).exports([]);
// diagnostic: wrong shape
DiBag.begin().bind(wrong, () => 'wrong').install(feature);
// diagnostic: wrong shape
DiBag.begin().install(feature).bind(wrong, () => 'wrong');
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
DiBag.begin().bind(optional, () => 1);
// diagnostic: not assignable
DiBag.begin().add({ optional });
declare const broad: readonly typeof optional[];
declare const maybeTuple: readonly [typeof optional?];
declare const unionTuple: readonly [typeof optional] | readonly [typeof lazy];
// diagnostic: finite tuple
DiBag.fromFunction(broad, (...values: (number | undefined)[]) => values);
// diagnostic: not assignable
DiBag.fromClass(maybeTuple, class { constructor(value?: number) {} });
// diagnostic: finite tuple
DiBag.fromTokens(unionTuple, value => value);
// diagnostic: not assignable
DiBag.fromFunction([optional], (value: number) => value);
// diagnostic: not assignable
DiBag.fromTokens([lazy], (value: number) => value);
// diagnostic: arguments must match
DiBag.fromFunction([lazy], () => 1);
// diagnostic: not assignable
DiBag.fromFunction([lazy], function (this: { id: number }, get: () => number) { return get() + this.id; });
// diagnostic: not assignable
DiBag.fromTokens([optional], function (this: { id: number }, value) { return this.id; });
// diagnostic: not assignable
DiBag.fromClass([optional], class { constructor(value: number) {} });
// diagnostic: native acquisition requires a Promise output
DiBag.fromFunction([optional], value => value, { acquisition: 'native' });
const root = DiBag.withLifetime(lazySource, 'root');
const rootOptional = DiBag.withLifetime(source, 'root');
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.begin().bind(number, () => 1).add({ root }).end();
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.begin().bind(number, () => 1).add({ rootOptional }).end();
const privateRoot = DiBag.module().add({ rootOptional }).exports([]);
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.begin().install(privateRoot).bind(number, () => 1).end();
const privateLazy = DiBag.module().bind(number, () => 1).add({ root }).exports(['root']).rename('root', 'renamed');
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.begin().install(privateLazy).end();
const valid = DiBag.begin().bind(number, DiBag.withLifetime(() => 1, 'root')).add({ root }).end();
// diagnostic: root lifetime cannot capture scoped dependency
valid.fork([number], { [key]: () => 2 });
// diagnostic: root lifetime cannot capture scoped dependency
valid.scope([number, 'root'], { [key]: () => 2, root });
declare const erasedProvider: Provider<() => number> | typeof source;
// diagnostic: incompatible
DiBag.begin().bind(wrong, () => 'wrong').add({ source: erasedProvider });
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
// diagnostic: native acquisition requires a Promise output
DiBag.fromFunction<readonly [typeof lazy], (get: () => number) => number, 'native'>([lazy], get => get(), { acquisition: 'native' });
declare const referenceUnion: typeof optional | typeof lazy;
// diagnostic: not assignable
DiBag.fromTokens([referenceUnion], value => value);
// diagnostic: Property 'nominal' is missing
DiBag.fromTokens([{ ...optional }], value => value);
// diagnostic: not assignable
const invariant: import('../../../src').OptionalReference<import('../../../src').Token<typeof key, number | string>> = optional;
const rootOptionalModule = DiBag.module().add({ rootOptional }).exports(['rootOptional']).rename('rootOptional', 'renamed');
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.begin().install(rootOptionalModule).bind(number, () => 1).end();
const bound = DiBag.begin().bind(number, () => 1).add({ source }).end();
// diagnostic: token binding output
DiBag.begin().bind(number, () => 1).add({ source }).replace(number, () => 'wrong');
// diagnostic: not assignable
bound.fork([number], { [key]: () => 'wrong' });
// diagnostic: not assignable
bound.scope([number], { [key]: () => 'wrong' });

declare const impossible: never;
// diagnostic: finite tuple
DiBag.fromTokens([impossible], value => value);
// diagnostic: finite tuple
DiBag.fromFunction<readonly [never], (value: never) => number>([impossible], value => 1);
