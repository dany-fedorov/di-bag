import { fromFunction } from '../../../src/composition';
import { DiBag, type Token, type Provider } from '../../../src';
import { withTokenBinding, type ProviderBase } from '../../../src/provider';
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
// diagnostic: not assignable to type 'DependencyReference'
fromFunction([{ ...token }], value => value);
declare const opaque: TokenBase;
// diagnostic: finite tuple
fromFunction([opaque], () => 1);
// diagnostic: finite tuple
fromFunction([token] as (typeof token)[], () => 1);
declare const optional: readonly [typeof token?];
// diagnostic: finite tuple
fromFunction(optional, () => 1);
declare const tupleUnion: readonly [typeof token] | readonly [typeof other];
// diagnostic: finite tuple
fromFunction(tupleUnion, () => 1);
// diagnostic: finite tuple
fromFunction([union === key ? token : other], () => 1);
// diagnostic: not assignable
fromFunction([token], function (this: { value: number }, value) { return this.value; });
// diagnostic: not assignable
fromFunction([token], (one: { value: number }, two: number) => two);
const provider = fromFunction([token], value => value.value);
// diagnostic: not assignable
const erased: Provider<() => number> = provider;
// diagnostic: required service registrations are missing
DiBag.createBuilder().withServices({ provider }).buildContainer();
// diagnostic: required service registrations are missing
DiBag.createBuilder().withInstalledModules([DiBag.createBuilder().withServices({ provider }).buildModule({ exportedServiceKeys: ['provider'] })]).buildContainer();
// diagnostic: required service registrations are missing
DiBag.createBuilder().withServices({ value: () => 1 }).withReplacedService('value', provider).buildContainer();
// diagnostic: not assignable
withTokenBinding(token, () => 'wrong');
declare const erasedProvider: ProviderBase;
// diagnostic: factory dependencies must be finite
DiBag.createBuilder().withServices({ erasedProvider });
// diagnostic: finite tuple
DiBag.fromFunction([token] as typeof token[], () => 1);
// diagnostic: finite tuple
fromFunction<readonly TokenBase[], () => number>([token], () => 1);
declare const graphErased: Provider<() => number, {}, readonly [], import('../../../src/token-types').OpaqueGraph>;
// diagnostic: incompatible or opaque
DiBag.createBuilder().withServices({ graphErased });
// diagnostic: not assignable
DiBag.createBuilder().withServices({ value: () => 1 }).buildContainer().fork(['value'], { value: provider });
const bound = withTokenBinding(token, () => ({ value: 1 }));
// diagnostic: duplicates
DiBag.createBuilder().withTokenService(token, bound).withTokenService(token, bound);
// diagnostic: not assignable
fromFunction([token], (value: string) => value);
// diagnostic: not assignable
withTokenBinding(token, DiBag.transformService(() => 1, { mode: 'direct', transform: () => 'wrong' }));
// diagnostic: cannot be used as a value
new Token(key);
