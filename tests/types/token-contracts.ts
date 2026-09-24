import { createProviderFromFunction } from '../../src/composition';
import { DiBag, type CollectionTokenBase, type Overrides, type SingleServiceTokenMember, type Token, type TokenKey, type TokenMember, type TokenService, type Provider, type ProviderCollectionTokens, type ProviderRequiredTokens, type ProviderNamedDependencies, type ProviderOutput, type ProviderRegistrationMetadata, type ProviderAcquisitionMetadata } from '../../src';
import { withTokenBinding, type ProviderGraphContract, type BoundToken, type ProviderFactory, type ProviderBase } from '../../src/provider';
import type { TokenDependencyContract, OpaqueGraph } from '../../src/token-types';
import type { TokenBase } from '../../src/tokens';
import type { Assert, Equal } from './assert';

const key = Symbol('number'); const otherKey = Symbol('other');
const token = DiBag.createToken(key).forService<number>();
const other = DiBag.createToken(otherKey).forService<Promise<string>>();
const source = createProviderFromFunction({ dependencies: [token, other], factoryFunction: (value, promise) => {
  type Inputs = [Assert<Equal<typeof value, number>>, Assert<Equal<typeof promise, Promise<string>>>];
  return { value, promise };
} });
type SourceGraph = TokenDependencyContract<readonly [typeof token, typeof other]>;
type Identity = [Assert<Equal<typeof token, Token<typeof key, number>>>, Assert<Equal<TokenKey<typeof token>, typeof key>>,
  Assert<Equal<TokenService<typeof token>, number>>, Assert<Equal<ProviderGraphContract<typeof source>, SourceGraph>>,
  Assert<Equal<ProviderRequiredTokens<typeof source>, typeof token | typeof other>>,
  Assert<Equal<ProviderFactory<typeof source>, () => { value: number; promise: Promise<string> }>>,
  Assert<Equal<ProviderNamedDependencies<typeof source>, Record<never, never>>>, Assert<Equal<BoundToken<typeof source>, never>>];
type EmptyCollectionGraph = TokenDependencyContract;
type BroadCollectionGraph = TokenDependencyContract<readonly [], never, readonly [], readonly CollectionTokenBase[]>;
type NonemptyCollectionGraph = TokenDependencyContract<readonly [], never, readonly [], readonly [CollectionTokenBase]>;
type NeverCollectionGraph = TokenDependencyContract<readonly [], never, readonly [], never>;
type BroadCollectionProvider = Provider<() => number, {}, readonly [], BroadCollectionGraph>;
type NonemptyCollectionProvider = Provider<() => number, {}, readonly [], NonemptyCollectionGraph>;
type NeverCollectionProvider = Provider<() => number, {}, readonly [], NeverCollectionGraph>;
type CollectionMetadataContracts = [
  Assert<Equal<Extract<keyof EmptyCollectionGraph, 'collections'>, never>>,
  Assert<Equal<Extract<keyof BroadCollectionGraph, 'collections'>, 'collections'>>,
  Assert<Equal<Extract<keyof NonemptyCollectionGraph, 'collections'>, 'collections'>>,
  Assert<Equal<Extract<keyof NeverCollectionGraph, 'collections'>, 'collections'>>,
  Assert<Equal<ProviderCollectionTokens<BroadCollectionProvider>, CollectionTokenBase>>,
  Assert<Equal<ProviderCollectionTokens<NonemptyCollectionProvider>, CollectionTokenBase>>,
  Assert<Equal<ProviderCollectionTokens<NeverCollectionProvider>, never>>,
];
type OverrideFacadeContracts = [
  Assert<Equal<Overrides<{ port: () => number }, { port: () => 1 }>, unknown>>,
  Assert<Equal<unknown extends Overrides<{ port: () => number }, { extra: () => number }> ? true : false, false>>,
  Assert<Equal<unknown extends Overrides<{ port: () => number }, { port: () => string }> ? true : false, false>>,
];
const annotated = DiBag.providerWithRegistrationMetadata({ provider: source, registrationMetadata: { owner: 'team' } });
const owned = DiBag.providerWithDisposal({ provider: annotated, disposeService: value => { type Value = Assert<Equal<typeof value, { value: number; promise: Promise<string> }>>; } });
const sync = DiBag.providerWithTransformedService({ provider: owned, transformService: value => value.promise, callbackReceives: 'exposed-service' });
const async = DiBag.providerWithTransformedService({ provider: sync, transformService: value => { type Value = Assert<Equal<typeof value, string>>; return value.length; }, callbackReceives: 'fulfilled-value' });
const bindingKey = Symbol('binding'); const binding = DiBag.createToken(bindingKey).forService<{ value: number; promise: Promise<string> }>();
const bound = withTokenBinding(binding, owned);
const collectionMemberKey = Symbol('collection member');
const collectionMember = DiBag.createToken(collectionMemberKey).forCollectionOf<number>();
type CollectionRegistration = import('../../src').TokenBinding<typeof collectionMember, () => readonly number[]>;
type TokenMemberFacadeContracts = [
  Assert<Equal<TokenMember<{ [bindingKey]: typeof bound }, typeof binding>, unknown>>,
  Assert<Equal<SingleServiceTokenMember<{ [bindingKey]: typeof bound }, typeof binding>, unknown>>,
  Assert<Equal<TokenMember<{ [collectionMemberKey]: CollectionRegistration }, typeof collectionMember>, unknown>>,
  Assert<Equal<unknown extends SingleServiceTokenMember<{ [collectionMemberKey]: CollectionRegistration }, typeof collectionMember> ? true : false, false>>,
  Assert<Equal<unknown extends TokenMember<{}, never> ? true : false, false>>,
];
type Retention = [Assert<Equal<ProviderGraphContract<typeof annotated>, SourceGraph>>, Assert<Equal<ProviderGraphContract<typeof owned>, SourceGraph>>,
  Assert<Equal<ProviderGraphContract<typeof sync>, SourceGraph>>, Assert<Equal<ProviderGraphContract<typeof async>, SourceGraph>>,
  Assert<Equal<ProviderGraphContract<typeof bound>, TokenDependencyContract<readonly [typeof token, typeof other], typeof binding>>>,
  Assert<Equal<BoundToken<typeof bound>, typeof binding>>, Assert<Equal<ProviderFactory<typeof bound>, ProviderFactory<typeof owned>>>,
  Assert<Equal<ProviderRegistrationMetadata<typeof bound>, Readonly<{ owner: string }>>>, Assert<Equal<ProviderAcquisitionMetadata<typeof bound>, readonly []>>,
  Assert<Equal<ProviderOutput<typeof sync>, Promise<string>>>, Assert<Equal<ProviderOutput<typeof async>, Promise<number>>>];
const immediate = createProviderFromFunction({ dependencies: [token], factoryFunction: value => value });
const annotatedSource = DiBag.providerWithTransformedService({ provider: createProviderFromFunction({ dependencies: [token], factoryFunction: value => value }), transformService: value => value, callbackReceives: 'exposed-service' });
const framed = DiBag.providerWithAcquisitionMetadata({ provider: annotatedSource, describeAcquisition: () => ({ source: 'frame' }), callbackReceives: 'exposed-service' });
const framedAwaited = DiBag.providerWithAcquisitionMetadata({ provider: annotatedSource, describeAcquisition: () => ({ source: 'frame' }), callbackReceives: 'fulfilled-value' });
const framedMetadata = DiBag.providerWithRegistrationMetadata({ provider: framed, registrationMetadata: { framed: true } });
const framedOwned = DiBag.providerWithDisposal({ provider: framedMetadata, disposeService: value => { type Value = Assert<Equal<typeof value, number>>; } });
const framedSync = DiBag.providerWithTransformedService({ provider: framedOwned, transformService: value => String(value), callbackReceives: 'exposed-service' });
const framedAsync = DiBag.providerWithTransformedService({ provider: framedOwned, transformService: value => String(value), callbackReceives: 'fulfilled-value' });
type Framed = [Assert<Equal<ProviderGraphContract<typeof framedMetadata>, TokenDependencyContract<readonly [typeof token]>>>,
  Assert<Equal<ProviderGraphContract<typeof framedOwned>, TokenDependencyContract<readonly [typeof token]>>>,
  Assert<Equal<ProviderGraphContract<typeof framedSync>, TokenDependencyContract<readonly [typeof token]>>>,
  Assert<Equal<ProviderGraphContract<typeof framedAsync>, TokenDependencyContract<readonly [typeof token]>>>,
  Assert<Equal<ProviderRegistrationMetadata<typeof framedSync>, Readonly<{ framed: boolean }>>>,
  Assert<Equal<ProviderRegistrationMetadata<typeof framedAsync>, Readonly<{ framed: boolean }>>>,
  Assert<Equal<ProviderAcquisitionMetadata<typeof framedOwned>, ProviderAcquisitionMetadata<typeof framed>>>,
  Assert<Equal<ProviderAcquisitionMetadata<typeof framedMetadata>, ProviderAcquisitionMetadata<typeof framed>>>,
  Assert<Equal<ProviderAcquisitionMetadata<typeof framedSync>, ProviderAcquisitionMetadata<typeof framed>>>,
  Assert<Equal<ProviderAcquisitionMetadata<typeof framedAsync>, ProviderAcquisitionMetadata<typeof framed>>>];
type AcquisitionContracts = [Assert<Equal<ProviderGraphContract<typeof immediate>, TokenDependencyContract<readonly [typeof token]>>>,
  Assert<Equal<ProviderGraphContract<typeof framed>, TokenDependencyContract<readonly [typeof token]>>>, Assert<Equal<ProviderGraphContract<typeof framedAwaited>, TokenDependencyContract<readonly [typeof token]>>>,
  Assert<Equal<ProviderOutput<typeof immediate>, number>>, Assert<Equal<ProviderOutput<typeof framed>, number>>, Assert<Equal<ProviderOutput<typeof framedAwaited>, Promise<number>>>,
  Assert<Equal<ProviderAcquisitionMetadata<typeof framed>, readonly [Readonly<{ source: string }>]>>];
const plain = ({ named }: { named: boolean }) => named;
const ordinary = DiBag.providerWithDisposal({ provider: () => 1, disposeService: () => {} });
type Mixed = typeof source | typeof plain | typeof ordinary;
type MixedGraph = SourceGraph | TokenDependencyContract;
type MixedChecks = [Assert<Equal<ProviderGraphContract<NoInfer<Mixed>>, MixedGraph>>,
  Assert<Equal<ProviderRequiredTokens<NoInfer<Mixed>>, typeof token | typeof other>>,
  Assert<Equal<ProviderFactory<NoInfer<Mixed>>, ProviderFactory<typeof source> | typeof plain | (() => number)>>,
  Assert<Equal<ProviderGraphContract<NoInfer<Mixed | ProviderBase>>, OpaqueGraph>>,
  Assert<Equal<ProviderRequiredTokens<NoInfer<Mixed | ProviderBase>>, TokenBase>>,
  Assert<Equal<BoundToken<NoInfer<Mixed | ProviderBase>>, TokenBase>>,
  Assert<Equal<ProviderGraphContract<NoInfer<typeof ordinary>>, TokenDependencyContract>>];
declare const mixed: Mixed;
const mixedMapped = DiBag.providerWithTransformedService({ provider: mixed, transformService: value => { type Value = Assert<Equal<typeof value, { value: number; promise: Promise<string> } | number | boolean>>; return value; }, callbackReceives: 'exposed-service' });
type MixedMapped = Assert<Equal<ProviderGraphContract<typeof mixedMapped>, MixedGraph>>;
type Heterogeneous = typeof framedOwned | typeof plain | typeof ordinary;
type HeterogeneousChecks = [Assert<Equal<ProviderRegistrationMetadata<NoInfer<Heterogeneous>>, Readonly<{}> | Readonly<{ framed: boolean }>>>,
  Assert<Equal<ProviderAcquisitionMetadata<NoInfer<Heterogeneous>>, readonly [] | ProviderAcquisitionMetadata<typeof framed>>>,
  Assert<Equal<ProviderGraphContract<NoInfer<Heterogeneous>>, TokenDependencyContract | TokenDependencyContract<readonly [typeof token]>>>,
  Assert<Equal<ProviderNamedDependencies<NoInfer<Heterogeneous>>, { named: boolean }>>,
  Assert<Equal<ProviderGraphContract<NoInfer<typeof bound | typeof plain>>, ProviderGraphContract<typeof bound> | TokenDependencyContract>>,
  Assert<Equal<BoundToken<NoInfer<typeof bound | typeof plain>>, typeof binding>>];
const empty = createProviderFromFunction({ dependencies: [], factoryFunction: () => 42 }); const defaultAnnotation: Provider<() => number> = empty;
const ignored = createProviderFromFunction({ dependencies: [token, other], factoryFunction: (_value, _promise) => Promise.resolve(42) });
type PromiseOutput = Assert<Equal<ProviderOutput<typeof ignored>, Promise<number>>>;
void [defaultAnnotation, ignored];

// Provider extraction must keep its branch order for callable/provider
// intersections and retain all graph and metadata property modifiers.
type ExtendedGraph = TokenDependencyContract<readonly [typeof token], never, readonly [typeof other]> & {
  readonly optionalMarker?: 'kept'; mutableMarker: number;
};
type Reflected = Provider<() => number, Readonly<{ optionalOwner?: 'team' }>, readonly [{ frame: 'kept' }], ExtendedGraph>;
type CallableProvider = ((deps: { named: string }) => string) & Reflected;
export type ExtractionBranchContracts = [
  Assert<Equal<ProviderGraphContract<CallableProvider>, ExtendedGraph>>,
  Assert<Equal<ProviderRegistrationMetadata<CallableProvider>, Readonly<{ optionalOwner?: 'team' }>>>,
  Assert<Equal<ProviderAcquisitionMetadata<CallableProvider>, readonly [{ frame: 'kept' }]>>,
  Assert<Equal<ProviderFactory<CallableProvider>, CallableProvider>>,
  Assert<Equal<ProviderGraphContract<NoInfer<Reflected | typeof plain>>, ExtendedGraph | TokenDependencyContract>>,
  Assert<Equal<ProviderRegistrationMetadata<NoInfer<Reflected | typeof plain>>, Readonly<{ optionalOwner?: 'team' }> | Readonly<{}>>>,
  Assert<Equal<ProviderGraphContract<Provider<() => number, {}, readonly [], TokenDependencyContract | OpaqueGraph>>, TokenDependencyContract | OpaqueGraph>>,
  Assert<Equal<ProviderRegistrationMetadata<ProviderBase>, unknown>>,
  Assert<Equal<ProviderGraphContract<ProviderBase>, OpaqueGraph>>,
];
