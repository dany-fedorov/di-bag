import { DiBag, type Token, type TokenKey, type TokenService, type Provider, type ProviderTokenNeeds, type ProviderNeeds, type ProviderOutput, type ProviderMetadata, type ProviderAcquisitionMetadata } from '../../src';
import { fromTokens, withTokenBinding, type ProviderGraph, type BoundToken, type ProviderFactory, type ProviderBase } from '../../src/provider';
import type { TokenGraph, OpaqueGraph } from '../../src/token-types';
import type { TokenBase } from '../../src/tokens';
import { fromSasBox } from '../../src/sas-box';
import { fromValBox, fromValBoxAsync } from '../../src/val-box';
import type { Assert, Equal } from './assert';

const key = Symbol('number'); const otherKey = Symbol('other');
const token = DiBag.token(key).of<number>();
const other = DiBag.token(otherKey).of<Promise<string>>();
const source = fromTokens([token, other], (value, promise) => {
  type Inputs = [Assert<Equal<typeof value, number>>, Assert<Equal<typeof promise, Promise<string>>>];
  return { value, promise };
});
type SourceGraph = TokenGraph<readonly [typeof token, typeof other]>;
type Identity = [Assert<Equal<typeof token, Token<typeof key, number>>>, Assert<Equal<TokenKey<typeof token>, typeof key>>,
  Assert<Equal<TokenService<typeof token>, number>>, Assert<Equal<ProviderGraph<typeof source>, SourceGraph>>,
  Assert<Equal<ProviderTokenNeeds<typeof source>, typeof token | typeof other>>,
  Assert<Equal<ProviderFactory<typeof source>, () => { value: number; promise: Promise<string> }>>,
  Assert<Equal<ProviderNeeds<typeof source>, Record<never, never>>>, Assert<Equal<BoundToken<typeof source>, never>>];
const annotated = DiBag.withMetadata(source, { owner: 'team' });
const owned = DiBag.withDisposal(annotated, value => { type Value = Assert<Equal<typeof value, { value: number; promise: Promise<string> }>>; });
const sync = DiBag.mapSync(owned, value => value.promise);
const async = DiBag.mapAsync(sync, value => { type Value = Assert<Equal<typeof value, string>>; return value.length; });
const bindingKey = Symbol('binding'); const binding = DiBag.token(bindingKey).of<{ value: number; promise: Promise<string> }>();
const bound = withTokenBinding(binding, owned);
type Retention = [Assert<Equal<ProviderGraph<typeof annotated>, SourceGraph>>, Assert<Equal<ProviderGraph<typeof owned>, SourceGraph>>,
  Assert<Equal<ProviderGraph<typeof sync>, SourceGraph>>, Assert<Equal<ProviderGraph<typeof async>, SourceGraph>>,
  Assert<Equal<ProviderGraph<typeof bound>, TokenGraph<readonly [typeof token, typeof other], typeof binding>>>,
  Assert<Equal<BoundToken<typeof bound>, typeof binding>>, Assert<Equal<ProviderFactory<typeof bound>, ProviderFactory<typeof owned>>>,
  Assert<Equal<ProviderMetadata<typeof bound>, Readonly<{ owner: string }>>>, Assert<Equal<ProviderAcquisitionMetadata<typeof bound>, readonly []>>,
  Assert<Equal<ProviderOutput<typeof sync>, Promise<string>>>, Assert<Equal<ProviderOutput<typeof async>, Promise<number>>>];
const boxed = fromTokens([token], value => ({ sync: () => value }));
const sas = fromSasBox(boxed, { mode: 'sync' });
const valSource = fromTokens([token], value => ({ snapshot: () => ({ value: { present: true as const, value }, metadata: { present: true as const, value: 'frame' }, alias: null }) }));
const val = fromValBox(valSource); const valAsync = fromValBoxAsync(valSource);
const framedMetadata = DiBag.withMetadata(val, { framed: true });
const framedOwned = DiBag.withDisposal(framedMetadata, value => { type Value = Assert<Equal<typeof value, number>>; });
const framedSync = DiBag.mapSync(framedOwned, value => String(value));
const framedAsync = DiBag.mapAsync(framedOwned, value => String(value));
type Framed = [Assert<Equal<ProviderGraph<typeof framedMetadata>, TokenGraph<readonly [typeof token]>>>,
  Assert<Equal<ProviderGraph<typeof framedOwned>, TokenGraph<readonly [typeof token]>>>,
  Assert<Equal<ProviderGraph<typeof framedSync>, TokenGraph<readonly [typeof token]>>>,
  Assert<Equal<ProviderGraph<typeof framedAsync>, TokenGraph<readonly [typeof token]>>>,
  Assert<Equal<ProviderMetadata<typeof framedSync>, Readonly<{ framed: boolean }>>>,
  Assert<Equal<ProviderMetadata<typeof framedAsync>, Readonly<{ framed: boolean }>>>,
  Assert<Equal<ProviderAcquisitionMetadata<typeof framedOwned>, ProviderAcquisitionMetadata<typeof val>>>,
  Assert<Equal<ProviderAcquisitionMetadata<typeof framedMetadata>, ProviderAcquisitionMetadata<typeof val>>>,
  Assert<Equal<ProviderAcquisitionMetadata<typeof framedSync>, ProviderAcquisitionMetadata<typeof val>>>,
  Assert<Equal<ProviderAcquisitionMetadata<typeof framedAsync>, ProviderAcquisitionMetadata<typeof val>>>];
type Boxes = [Assert<Equal<ProviderGraph<typeof sas>, TokenGraph<readonly [typeof token]>>>,
  Assert<Equal<ProviderGraph<typeof val>, TokenGraph<readonly [typeof token]>>>, Assert<Equal<ProviderGraph<typeof valAsync>, TokenGraph<readonly [typeof token]>>>,
  Assert<Equal<ProviderOutput<typeof sas>, number>>, Assert<Equal<ProviderOutput<typeof val>, number>>, Assert<Equal<ProviderOutput<typeof valAsync>, Promise<number>>>,
  Assert<Equal<ProviderAcquisitionMetadata<typeof val>, readonly [import('../../src').ValBoxFrame<string>]>>];
const plain = ({ named }: { named: boolean }) => named;
const ordinary = DiBag.withDisposal(() => 1, () => {});
type Mixed = typeof source | typeof plain | typeof ordinary;
type MixedGraph = SourceGraph | TokenGraph;
type MixedChecks = [Assert<Equal<ProviderGraph<NoInfer<Mixed>>, MixedGraph>>,
  Assert<Equal<ProviderTokenNeeds<NoInfer<Mixed>>, typeof token | typeof other>>,
  Assert<Equal<ProviderFactory<NoInfer<Mixed>>, ProviderFactory<typeof source> | typeof plain | (() => number)>>,
  Assert<Equal<ProviderGraph<NoInfer<Mixed | ProviderBase>>, OpaqueGraph>>,
  Assert<Equal<ProviderTokenNeeds<NoInfer<Mixed | ProviderBase>>, TokenBase>>,
  Assert<Equal<BoundToken<NoInfer<Mixed | ProviderBase>>, TokenBase>>,
  Assert<Equal<ProviderGraph<NoInfer<typeof ordinary>>, TokenGraph>>];
declare const mixed: Mixed;
const mixedMapped = DiBag.mapSync(mixed, value => { type Value = Assert<Equal<typeof value, { value: number; promise: Promise<string> } | number | boolean>>; return value; });
type MixedMapped = Assert<Equal<ProviderGraph<typeof mixedMapped>, MixedGraph>>;
type Heterogeneous = typeof framedOwned | typeof plain | typeof ordinary;
type HeterogeneousChecks = [Assert<Equal<ProviderMetadata<NoInfer<Heterogeneous>>, Readonly<{}> | Readonly<{ framed: boolean }>>>,
  Assert<Equal<ProviderAcquisitionMetadata<NoInfer<Heterogeneous>>, readonly [] | ProviderAcquisitionMetadata<typeof val>>>,
  Assert<Equal<ProviderGraph<NoInfer<Heterogeneous>>, TokenGraph | TokenGraph<readonly [typeof token]>>>,
  Assert<Equal<ProviderNeeds<NoInfer<Heterogeneous>>, Record<never, never> | { named: boolean }>>,
  Assert<Equal<ProviderGraph<NoInfer<typeof bound | typeof plain>>, ProviderGraph<typeof bound> | TokenGraph>>,
  Assert<Equal<BoundToken<NoInfer<typeof bound | typeof plain>>, typeof binding>>];
const empty = fromTokens([], () => 42); const defaultAnnotation: Provider<() => number> = empty;
const ignored = fromTokens([token, other], () => Promise.resolve(42));
type PromiseOutput = Assert<Equal<ProviderOutput<typeof ignored>, Promise<number>>>;
void [defaultAnnotation, ignored];
