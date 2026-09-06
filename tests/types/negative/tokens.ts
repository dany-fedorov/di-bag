import { DiBag, type Token } from '../../../src';
import type { Provider } from '../../../src';
import type { OpaqueGraph } from '../../../src/token-types';
import type { TokenGraph } from '../../../src/token-types';
import type { TokenBase } from '../../../src/tokens';
const key = Symbol('same'); const otherKey = Symbol('same');
const token = DiBag.token(key).of<{ value: number }>();
const other = DiBag.token(otherKey).of<{ value: number }>();
const conflict = DiBag.token(key).of<{ extra: boolean }>();
const source = DiBag.fromTokens([token], value => value.value);
// diagnostic: missing factories
DiBag.begin().add({ source }).end();
// diagnostic: missing factories
DiBag.begin().bind(other, () => ({ value: 1 })).add({ source }).end();
// diagnostic: not assignable
DiBag.begin().bind(token, () => ({ value: 'wrong' }));
// diagnostic: not assignable
DiBag.module().bind(token, DiBag.mapSync(() => 1, () => ({ value: 'wrong' })));
const builder = DiBag.begin().bind(token, () => ({ value: 1, extra: true })); const bag = builder.end();
// diagnostic: duplicates
builder.bind(token, () => ({ value: 2 }));
// diagnostic: incompatible
builder.add({ conflict: DiBag.fromTokens([conflict], value => value.extra) });
// diagnostic: incompatible
DiBag.begin().add({ conflict: DiBag.fromTokens([conflict], value => value.extra) }).bind(token, () => ({ value: 1, extra: true }));
// diagnostic: not assignable
bag.resolve(other);
// diagnostic: not assignable
bag.resolve(conflict);
// diagnostic: not assignable
bag.inspect(conflict);
// diagnostic: not assignable
builder.replace(token, () => ({ value: 'wrong' }));
// diagnostic: missing factories
builder.replace(token, ({ missing }: { missing: number }) => ({ value: missing })).end();
// diagnostic: wrong shape
DiBag.begin().bind(token, ({ name }: { name: string }) => ({ value: name.length })).add({ name: () => 1 });
// diagnostic: wrong shape
DiBag.begin().add({ name: () => 1 }).bind(token, ({ name }: { name: string }) => ({ value: name.length }));
// diagnostic: not assignable
bag.fork([token], { [key]: () => ({ value: 2 }) });
// diagnostic: does not exist
bag.fork([token], { [otherKey]: () => ({ value: 2, extra: true }) });
// diagnostic: does not satisfy
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
DiBag.begin().bind<TokenBase, () => { value: number }>(token, () => ({ value: 1 }));
declare const opaque: Provider<() => { value: number }, {}, readonly [], OpaqueGraph>;
// diagnostic: incompatible
DiBag.begin().bind(token, opaque);
declare const opaqueBinding: Provider<() => number, {}, readonly [], TokenGraph<readonly [], TokenBase>>;
// diagnostic: incompatible
DiBag.begin().add({ opaqueBinding });
// diagnostic: not assignable
bag.fork([token], { [key]: opaque });
// diagnostic: missing factories
bag.fork([token], { [key]: DiBag.fromTokens([other], () => ({ value: 2, extra: true })) });
declare const unionToken: typeof token | typeof other;
// diagnostic: not assignable
bag.resolve(unionToken);
const secondKey = Symbol('second'); const second = DiBag.token(secondKey).of<number>();
const pair = DiBag.begin().bind(token, () => ({ value: 1, extra: true })).bind(second, () => 1).end();
// diagnostic: not assignable
pair.fork([token, second], { [key]: ({ named }: { named: string }) => ({ value: named.length, extra: true }), [secondKey]: () => 1 });
const namedPair = DiBag.begin().bind(token, () => ({ value: 1 })).add({ named: () => ({ count: 1 }) }).end();
const wrongEdges = { [key]: ({ named }: { named: { extra: boolean } }) => ({ value: named.extra ? 1 : 0 }), named: () => ({ count: 2 }) };
// diagnostic: not assignable
namedPair.fork([token, 'named'], wrongEdges);
// diagnostic: wrong shape
DiBag.begin().bind(token, () => ({ value: 1, extra: true })).add({ consumer: ({ named }: { named: string }) => named }).add({ named: () => 1 });
