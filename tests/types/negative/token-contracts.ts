import { DiBag, type Token, type Provider } from '../../../src';
import { fromTokens, withTokenBinding, type ProviderBase } from '../../../src/provider';
import type { TokenBase } from '../../../src/tokens';
const key = Symbol('same'); const otherKey = Symbol('same');
const token = DiBag.token(key).of<{ value: number }>();
const other = DiBag.token(otherKey).of<{ value: number }>();
// diagnostic: not assignable
const wrongKey: typeof token = other;
// diagnostic: not assignable
const widerService: Token<typeof key, object> = token;
// diagnostic: read-only
token.key = key;
declare const broad: symbol;
// diagnostic: singleton unique-symbol
DiBag.token(broad);
// diagnostic: singleton unique-symbol
DiBag.token(Symbol('inline'));
// diagnostic: singleton unique-symbol
DiBag.token<symbol>(key);
declare const union: typeof key | typeof otherKey;
// diagnostic: singleton unique-symbol
DiBag.token(union);
declare const impossible: never;
// diagnostic: Expected 2 arguments
DiBag.token<never>(impossible);
const returnedSymbol = () => Symbol('returned');
// diagnostic: singleton unique-symbol
DiBag.token(returnedSymbol());
// diagnostic: not assignable
const widenedIdentity: Token<symbol, { value: number }> = token;
// diagnostic: Property 'nominal' is missing
fromTokens([{ ...token }], value => value);
declare const opaque: TokenBase;
// diagnostic: finite tuple
fromTokens([opaque], () => 1);
// diagnostic: finite tuple
fromTokens([token] as (typeof token)[], () => 1);
declare const optional: readonly [typeof token?];
// diagnostic: finite tuple
fromTokens(optional, () => 1);
declare const tupleUnion: readonly [typeof token] | readonly [typeof other];
// diagnostic: finite tuple
fromTokens(tupleUnion, () => 1);
// diagnostic: finite tuple
fromTokens([union === key ? token : other], () => 1);
// diagnostic: not assignable
fromTokens([token], function (this: { value: number }, value) { return this.value; });
// diagnostic: not assignable
fromTokens([token], (one, two: number) => two);
const provider = fromTokens([token], value => value.value);
// diagnostic: not assignable
const erased: Provider<() => number> = provider;
// diagnostic: token contracts require token graph composition
DiBag.begin().add({ provider }).end();
// diagnostic: token contracts require token graph composition
DiBag.module().add({ provider }).exports(['provider']);
// diagnostic: token contracts require token graph composition
DiBag.begin().add({ value: () => 1 }).replace('value', provider);
// diagnostic: not assignable
withTokenBinding(token, () => 'wrong');
declare const erasedProvider: ProviderBase;
// diagnostic: factory dependencies must be finite
DiBag.begin().add({ erasedProvider });
// diagnostic: does not exist
DiBag.fromTokens([token], () => 1);
// diagnostic: finite tuple
fromTokens<readonly TokenBase[], () => number>([token], () => 1);
declare const graphErased: Provider<() => number, {}, readonly [], import('../../../src/token-types').OpaqueGraph>;
// diagnostic: token contracts require token graph composition
DiBag.begin().add({ graphErased });
// diagnostic: not assignable
DiBag.begin().add({ value: () => 1 }).end().fork(['value'], { value: provider });
const bound = withTokenBinding(token, () => ({ value: 1 }));
// diagnostic: token contracts require token graph composition
DiBag.begin().add({ bound });
// diagnostic: not assignable
fromTokens([token], (value: string) => value);
// diagnostic: not assignable
withTokenBinding(token, DiBag.mapSync(() => 1, () => 'wrong'));
// diagnostic: cannot be used as a value
new Token(key);
