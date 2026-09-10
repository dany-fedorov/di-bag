import { DiBag, type Token } from '../../../src';
import type { Provider } from '../../../src';
import type { OpaqueGraph } from '../../../src/token-types';
import type { TokenDependencyContract } from '../../../src/token-types';
import type { TokenBase } from '../../../src/tokens';
const key = Symbol('same'); const otherKey = Symbol('same');
const token = DiBag.token(key).of<{ value: number }>();
const other = DiBag.token(otherKey).of<{ value: number }>();
const conflict = DiBag.token(key).of<{ extra: boolean }>();
const source = DiBag.fromFunction([token], value => value.value);
// diagnostic: required service registrations are missing
DiBag.createBuilder().register({ source }).build();
// diagnostic: required service registrations are missing
DiBag.createBuilder().register(other, () => ({ value: 1 })).register({ source }).build();
// diagnostic: not assignable
DiBag.createBuilder().register(token, () => ({ value: 'wrong' }));
// diagnostic: not assignable
DiBag.createBuilder().register(token, DiBag.transformService(() => 1, { mode: 'direct', transform: () => ({ value: 'wrong' }) }));
const builder = DiBag.createBuilder().register(token, () => ({ value: 1, extra: true })); const bag = builder.build();
// diagnostic: duplicates
builder.register(token, () => ({ value: 2 }));
// diagnostic: incompatible
builder.register({ conflict: DiBag.fromFunction([conflict], value => value.extra) });
// diagnostic: incompatible
DiBag.createBuilder().register({ conflict: DiBag.fromFunction([conflict], value => value.extra) }).register(token, () => ({ value: 1, extra: true }));
// diagnostic: not assignable
bag.resolve(other);
// diagnostic: not assignable
bag.resolve(conflict);
// diagnostic: not assignable
bag.inspect(conflict);
// diagnostic: not assignable
builder.replace(token, () => ({ value: 'wrong' }));
// diagnostic: required service registrations are missing
builder.replace(token, ({ missing }: { missing: number }) => ({ value: missing })).build();
// diagnostic: consumer dependency
DiBag.createBuilder().register(token, ({ name }: { name: string }) => ({ value: name.length })).register({ name: () => 1 });
// diagnostic: consumer dependency
DiBag.createBuilder().register({ name: () => 1 }).register(token, ({ name }: { name: string }) => ({ value: name.length }));
// diagnostic: not assignable
bag.fork([token], { [key]: () => ({ value: 2 }) });
// diagnostic: does not exist
bag.fork([token], { [otherKey]: () => ({ value: 2, extra: true }) });
// diagnostic: Property '[key]' is missing
bag.fork<readonly [typeof token], {}>([token], {});
declare const selection: readonly [typeof token] | readonly [];
// diagnostic: finite tuple
bag.fork(selection, { [key]: () => ({ value: 2, extra: true }) });
declare const broad: readonly typeof token[];
// diagnostic: finite tuple
bag.fork(broad, { [key]: () => ({ value: 2, extra: true }) });
declare const optional: readonly [typeof token?];
// diagnostic: finite tuple
bag.fork(optional, { [key]: () => ({ value: 2, extra: true }) });
declare const erased: TokenBase;
// diagnostic: not assignable
bag.resolve(erased);
// diagnostic: finite tuple
DiBag.createBuilder().register<TokenBase, () => { value: number }>(token, () => ({ value: 1 }));
declare const opaque: Provider<() => { value: number }, {}, readonly [], OpaqueGraph>;
// diagnostic: incompatible
DiBag.createBuilder().register(token, opaque);
declare const opaqueBinding: Provider<() => number, {}, readonly [], TokenDependencyContract<readonly [], TokenBase>>;
// diagnostic: incompatible
DiBag.createBuilder().register({ opaqueBinding });
// diagnostic: not assignable
bag.fork([token], { [key]: opaque });
// diagnostic: required service registrations are missing
bag.fork([token], { [key]: DiBag.fromFunction([other], (_dependency0) => ({ value: 2, extra: true })) });
declare const unionToken: typeof token | typeof other;
// diagnostic: not assignable
bag.resolve(unionToken);
const secondKey = Symbol('second'); const second = DiBag.token(secondKey).of<number>();
const pair = DiBag.createBuilder().register(token, () => ({ value: 1, extra: true })).register(second, () => 1).build();
// diagnostic: not assignable
pair.fork([token, second], { [key]: ({ named }: { named: string }) => ({ value: named.length, extra: true }), [secondKey]: () => 1 });
const namedPair = DiBag.createBuilder().register(token, () => ({ value: 1 })).register({ named: () => ({ count: 1 }) }).build();
const wrongEdges = { [key]: ({ named }: { named: { extra: boolean } }) => ({ value: named.extra ? 1 : 0 }), named: () => ({ count: 2 }) };
// diagnostic: not assignable
namedPair.fork([token, 'named'], wrongEdges);
// diagnostic: consumer dependency
DiBag.createBuilder().register(token, () => ({ value: 1, extra: true })).register({ consumer: ({ named }: { named: string }) => named }).register({ named: () => 1 });
