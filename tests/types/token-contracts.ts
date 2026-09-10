import { fromFunction } from '../../src/composition';
import { DiBag, type Token, type TokenKey, type TokenService, type Provider, type ProviderRequiredTokens, type ProviderNamedDependencies, type ProviderOutput, type ProviderRegistrationMetadata, type ProviderAcquisitionMetadata } from '../../src';
import { withTokenBinding, type ProviderGraphContract, type BoundToken, type ProviderFactory, type ProviderBase } from '../../src/provider';
import type { TokenDependencyContract, OpaqueGraph } from '../../src/token-types';
import type { TokenBase } from '../../src/tokens';
import type { Assert, Equal } from './assert';

const key = Symbol('number'); const otherKey = Symbol('other');
const token = DiBag.token(key).of<number>();
const other = DiBag.token(otherKey).of<Promise<string>>();
const source = fromFunction([token, other], (value, promise) => {
  type Inputs = [Assert<Equal<typeof value, number>>, Assert<Equal<typeof promise, Promise<string>>>];
  return { value, promise };
});
type SourceGraph = TokenDependencyContract<readonly [typeof token, typeof other]>;
type Identity = [Assert<Equal<typeof token, Token<typeof key, number>>>, Assert<Equal<TokenKey<typeof token>, typeof key>>,
  Assert<Equal<TokenService<typeof token>, number>>, Assert<Equal<ProviderGraphContract<typeof source>, SourceGraph>>,
  Assert<Equal<ProviderRequiredTokens<typeof source>, typeof token | typeof other>>,
  Assert<Equal<ProviderFactory<typeof source>, () => { value: number; promise: Promise<string> }>>,
  Assert<Equal<ProviderNamedDependencies<typeof source>, Record<never, never>>>, Assert<Equal<BoundToken<typeof source>, never>>];
const annotated = DiBag.withMetadata(source, { static: { owner: 'team' } });
const owned = DiBag.withDisposal(annotated, value => { type Value = Assert<Equal<typeof value, { value: number; promise: Promise<string> }>>; });
const sync = DiBag.transformService(owned, { mode: 'direct', transform: value => value.promise });
const async = DiBag.transformService(sync, { mode: 'awaited', transform: value => { type Value = Assert<Equal<typeof value, string>>; return value.length; } });
const bindingKey = Symbol('binding'); const binding = DiBag.token(bindingKey).of<{ value: number; promise: Promise<string> }>();
const bound = withTokenBinding(binding, owned);
type Retention = [Assert<Equal<ProviderGraphContract<typeof annotated>, SourceGraph>>, Assert<Equal<ProviderGraphContract<typeof owned>, SourceGraph>>,
  Assert<Equal<ProviderGraphContract<typeof sync>, SourceGraph>>, Assert<Equal<ProviderGraphContract<typeof async>, SourceGraph>>,
  Assert<Equal<ProviderGraphContract<typeof bound>, TokenDependencyContract<readonly [typeof token, typeof other], typeof binding>>>,
  Assert<Equal<BoundToken<typeof bound>, typeof binding>>, Assert<Equal<ProviderFactory<typeof bound>, ProviderFactory<typeof owned>>>,
  Assert<Equal<ProviderRegistrationMetadata<typeof bound>, Readonly<{ owner: string }>>>, Assert<Equal<ProviderAcquisitionMetadata<typeof bound>, readonly []>>,
  Assert<Equal<ProviderOutput<typeof sync>, Promise<string>>>, Assert<Equal<ProviderOutput<typeof async>, Promise<number>>>];
const immediate = fromFunction([token], value => value);
const annotatedSource = DiBag.transformService(fromFunction([token], value => value), { mode: 'direct', transform: value => value });
const framed = DiBag.withMetadata(annotatedSource, { dynamic: { mode: 'direct', describe: () => ({ source: 'frame' }) } });
const framedAwaited = DiBag.withMetadata(annotatedSource, { dynamic: { mode: 'awaited', describe: () => ({ source: 'frame' }) } });
const framedMetadata = DiBag.withMetadata(framed, { static: { framed: true } });
const framedOwned = DiBag.withDisposal(framedMetadata, value => { type Value = Assert<Equal<typeof value, number>>; });
const framedSync = DiBag.transformService(framedOwned, { mode: 'direct', transform: value => String(value) });
const framedAsync = DiBag.transformService(framedOwned, { mode: 'awaited', transform: value => String(value) });
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
const ordinary = DiBag.withDisposal(() => 1, () => {});
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
const mixedMapped = DiBag.transformService(mixed, { mode: 'direct', transform: value => { type Value = Assert<Equal<typeof value, { value: number; promise: Promise<string> } | number | boolean>>; return value; } });
type MixedMapped = Assert<Equal<ProviderGraphContract<typeof mixedMapped>, MixedGraph>>;
type Heterogeneous = typeof framedOwned | typeof plain | typeof ordinary;
type HeterogeneousChecks = [Assert<Equal<ProviderRegistrationMetadata<NoInfer<Heterogeneous>>, Readonly<{}> | Readonly<{ framed: boolean }>>>,
  Assert<Equal<ProviderAcquisitionMetadata<NoInfer<Heterogeneous>>, readonly [] | ProviderAcquisitionMetadata<typeof framed>>>,
  Assert<Equal<ProviderGraphContract<NoInfer<Heterogeneous>>, TokenDependencyContract | TokenDependencyContract<readonly [typeof token]>>>,
  Assert<Equal<ProviderNamedDependencies<NoInfer<Heterogeneous>>, Record<never, never> | { named: boolean }>>,
  Assert<Equal<ProviderGraphContract<NoInfer<typeof bound | typeof plain>>, ProviderGraphContract<typeof bound> | TokenDependencyContract>>,
  Assert<Equal<BoundToken<NoInfer<typeof bound | typeof plain>>, typeof binding>>];
const empty = fromFunction([], () => 42); const defaultAnnotation: Provider<() => number> = empty;
const ignored = fromFunction([token, other], (_value, _promise) => Promise.resolve(42));
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
