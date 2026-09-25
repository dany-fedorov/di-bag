import { DiBag, type Token } from '../../../src';
import type { Provider } from '../../../src';
import type { OpaqueGraph } from '../../../src/token-types';
import type { TokenDependencyContract } from '../../../src/token-types';
import type { TokenBase } from '../../../src/tokens';
const key = Symbol('same'); const otherKey = Symbol('same');
const token = DiBag.createToken(key).forService<{ value: number }>();
const other = DiBag.createToken(otherKey).forService<{ value: number }>();
const conflict = DiBag.createToken(key).forService<{ extra: boolean }>();
const source = DiBag.createProviderFromFunction({ dependencies: [token], factoryFunction: value => value.value });
// diagnostic: required services are missing
DiBag.createBuilder().withServices({ source }).buildContainer();
// diagnostic: required services are missing
DiBag.createBuilder().withTokenService(other, () => ({ value: 1 })).withServices({ source }).buildContainer();
// diagnostic: not assignable
DiBag.createBuilder().withTokenService(token, () => ({ value: 'wrong' }));
// diagnostic: not assignable
DiBag.createBuilder().withTokenService(token, DiBag.providerWithTransformedService({ provider: () => 1, transformService: () => ({ value: 'wrong' }), callbackReceives: 'exposed-service' }));
const builder = DiBag.createBuilder().withTokenService(token, () => ({ value: 1, extra: true })); const bag = builder.buildContainer();
// diagnostic: duplicates
builder.withTokenService(token, () => ({ value: 2 }));
// diagnostic: incompatible
builder.withServices({ conflict: DiBag.createProviderFromFunction({ dependencies: [conflict], factoryFunction: value => value.extra }) });
// diagnostic: incompatible
DiBag.createBuilder().withServices({ conflict: DiBag.createProviderFromFunction({ dependencies: [conflict], factoryFunction: value => value.extra }) }).withTokenService(token, () => ({ value: 1, extra: true }));
// diagnostic: not assignable
bag.resolve(other);
// diagnostic: token must match an existing binding contract; see https://dany-fedorov.github.io/di-bag/agent/errors.html#unknown-key
bag.resolve(conflict);
// diagnostic: token must match an existing binding contract; see https://dany-fedorov.github.io/di-bag/agent/errors.html#unknown-key
bag.serviceSnapshot(conflict);
// diagnostic: not assignable
builder.withReplacedService(token, () => ({ value: 'wrong' }));
// diagnostic: required services are missing
builder.withReplacedService(token, ({ missing }: { missing: number }) => ({ value: missing })).buildContainer();
// diagnostic: consumer dependency
DiBag.createBuilder().withTokenService(token, ({ name }: { name: string }) => ({ value: name.length })).withServices({ name: () => 1 });
// diagnostic: consumer dependency
DiBag.createBuilder().withServices({ name: () => 1 }).withTokenService(token, ({ name }: { name: string }) => ({ value: name.length }));
// diagnostic: not assignable
bag.createIndependentContainer([token], { [key]: () => ({ value: 2 }) });
// diagnostic: does not exist
bag.createIndependentContainer([token], { [otherKey]: () => ({ value: 2, extra: true }) });
// diagnostic: Property '[key]' is missing
bag.createIndependentContainer<readonly [typeof token], {}>([token], {});
declare const selection: readonly [typeof token] | readonly [];
// diagnostic: finite tuple
bag.createIndependentContainer(selection, { [key]: () => ({ value: 2, extra: true }) });
declare const broad: readonly typeof token[];
// diagnostic: finite tuple
bag.createIndependentContainer(broad, { [key]: () => ({ value: 2, extra: true }) });
declare const optional: readonly [typeof token?];
// diagnostic: finite tuple
bag.createIndependentContainer(optional, { [key]: () => ({ value: 2, extra: true }) });
declare const erased: TokenBase;
// diagnostic: not assignable
bag.resolve(erased);
// diagnostic: finite tuple
DiBag.createBuilder().withTokenService<TokenBase, () => { value: number }>(token, () => ({ value: 1 }));
declare const opaque: Provider<() => { value: number }, {}, readonly [], OpaqueGraph>;
// diagnostic: incompatible
DiBag.createBuilder().withTokenService(token, opaque);
declare const opaqueBinding: Provider<() => number, {}, readonly [], TokenDependencyContract<readonly [], TokenBase>>;
// diagnostic: incompatible
DiBag.createBuilder().withServices({ opaqueBinding });
// diagnostic: not assignable
bag.createIndependentContainer([token], { [key]: opaque });
// diagnostic: required services are missing
bag.createIndependentContainer([token], { [key]: DiBag.createProviderFromFunction({ dependencies: [other], factoryFunction: (_dependency0) => ({ value: 2, extra: true }) }) });
declare const unionToken: typeof token | typeof other;
// diagnostic: not assignable
bag.resolve(unionToken);
const secondKey = Symbol('second'); const second = DiBag.createToken(secondKey).forService<number>();
const pair = DiBag.createBuilder().withTokenService(token, () => ({ value: 1, extra: true })).withTokenService(second, () => 1).buildContainer();
// diagnostic: not assignable
pair.createIndependentContainer([token, second], { [key]: ({ named }: { named: string }) => ({ value: named.length, extra: true }), [secondKey]: () => 1 });
const namedPair = DiBag.createBuilder().withTokenService(token, () => ({ value: 1 })).withServices({ named: () => ({ count: 1 }) }).buildContainer();
const wrongEdges = { [key]: ({ named }: { named: { extra: boolean } }) => ({ value: named.extra ? 1 : 0 }), named: () => ({ count: 2 }) };
// diagnostic: not assignable
namedPair.createIndependentContainer([token, 'named'], wrongEdges);
// diagnostic: consumer dependency
DiBag.createBuilder().withTokenService(token, () => ({ value: 1, extra: true })).withServices({ consumer: ({ named }: { named: string }) => named }).withServices({ named: () => 1 });
