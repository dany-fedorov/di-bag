import { createProviderFromFunction } from '../../../src/composition';
import { DiBag, type Token, type Provider } from '../../../src';
import { withTokenBinding, type ProviderBase } from '../../../src/provider';
import type { TokenBase } from '../../../src/tokens';
const key = Symbol('same'); const otherKey = Symbol('same');
const token = DiBag.createToken(key).forService<{ value: number }>();
const other = DiBag.createToken(otherKey).forService<{ value: number }>();
// diagnostic: not assignable
const wrongKey: typeof token = other;
// diagnostic: not assignable
const widerService: Token<typeof key, object> = token;
// diagnostic: read-only
token.symbol = key;
declare const broad: symbol;
// diagnostic: singleton unique-symbol
DiBag.createToken(broad);
// diagnostic: singleton unique-symbol
DiBag.createToken(Symbol('inline'));
// diagnostic: singleton unique-symbol
DiBag.createToken<symbol>(key);
declare const union: typeof key | typeof otherKey;
// diagnostic: singleton unique-symbol
DiBag.createToken(union);
declare const impossible: never;
// diagnostic: Expected 2 arguments
DiBag.createToken<never>(impossible);
const returnedSymbol = () => Symbol('returned');
// diagnostic: singleton unique-symbol
DiBag.createToken(returnedSymbol());
// diagnostic: not assignable
const widenedIdentity: Token<symbol, { value: number }> = token;
// diagnostic: not assignable to type 'DependencyReference'
createProviderFromFunction({ dependencies: [{ ...token }], factoryFunction: value => value });
declare const opaque: TokenBase;
// diagnostic: finite tuple
// diagnostic-also: TS2322 positional factory arguments must match the declared parameter tuple
createProviderFromFunction({ dependencies: [opaque], factoryFunction: () => 1 });
// diagnostic: finite tuple
// diagnostic-also: TS2322 positional factory arguments must match the declared parameter tuple
createProviderFromFunction({ dependencies: [token] as (typeof token)[], factoryFunction: () => 1 });
declare const optional: readonly [typeof token?];
// diagnostic: finite tuple
// diagnostic-also: TS2322 positional factory arguments must match the declared parameter tuple
createProviderFromFunction({ dependencies: optional, factoryFunction: () => 1 });
declare const tupleUnion: readonly [typeof token] | readonly [typeof other];
// diagnostic: finite tuple
createProviderFromFunction({ dependencies: tupleUnion, factoryFunction: () => 1 });
// diagnostic: finite tuple
// diagnostic-also: TS2322 positional factory arguments must match the declared parameter tuple
createProviderFromFunction({ dependencies: [union === key ? token : other], factoryFunction: () => 1 });
// diagnostic: not assignable
createProviderFromFunction({ dependencies: [token], factoryFunction: function (this: { value: number }, value) { return this.value; } });
// diagnostic: not assignable
createProviderFromFunction({ dependencies: [token], factoryFunction: (one: { value: number }, two: number) => two });
const provider = createProviderFromFunction({ dependencies: [token], factoryFunction: value => value.value });
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
// diagnostic-also: TS2322 positional factory arguments must match the declared parameter tuple
DiBag.createProviderFromFunction({ dependencies: [token] as typeof token[], factoryFunction: () => 1 });
// diagnostic: finite tuple
// diagnostic-also: TS2322 positional factory arguments must match the declared parameter tuple
createProviderFromFunction<readonly TokenBase[], () => number>({ dependencies: [token], factoryFunction: () => 1 });
declare const graphErased: Provider<() => number, {}, readonly [], import('../../../src/token-types').OpaqueGraph>;
// diagnostic: incompatible or opaque
DiBag.createBuilder().withServices({ graphErased });
// diagnostic: not assignable
DiBag.createBuilder().withServices({ value: () => 1 }).buildContainer().createIndependentContainer(['value'], { value: provider });
const bound = withTokenBinding(token, () => ({ value: 1 }));
// diagnostic: duplicates
DiBag.createBuilder().withTokenService(token, bound).withTokenService(token, bound);
// diagnostic: not assignable
createProviderFromFunction({ dependencies: [token], factoryFunction: (value: string) => value });
// diagnostic: not assignable
withTokenBinding(token, DiBag.providerWithTransformedService({ provider: () => 1, transformService: () => 'wrong', callbackReceives: 'exposed-service' }));
// diagnostic: cannot be used as a value
new Token(key);
