import {
  DiBag,
  type ProviderAcquisitionMetadata,
  type ProviderMetadata,
  type TokenGraph,
} from '../../src';
import type { ProviderGraph } from '../../src/provider';
import type { Assert, Equal } from './assert';
import type { IncrementalChecked, Entry, Unsatisfied } from '../../src/types';
import type { Builder, Registration } from '../../src';

const forward = DiBag.begin().add({ read: ({ value }: { value: number }) => value })
  .add({ value: () => 1 }).end();
const forwardValue = forward.resolve('read');
type Forward = Assert<Equal<typeof forwardValue, number>>;

const key = Symbol('service');
const token = DiBag.token(key).of<{ value: number }>();
const same = DiBag.token(key).of<{ value: number }>();
const initial = DiBag.begin().add({ read: DiBag.fromTokens([same], value => value.value) })
  .bind(token, () => ({ value: 1, original: true as const }));
const replaced = initial.replace(token, () => ({ value: 2, richer: true as const })).end();
const actual = replaced.resolve(token);
type Rich = Assert<Equal<typeof actual, { value: number; richer: true }>>;

const feature = DiBag.module().add({ hidden: ({ external }: { external: number }) => external }).exports([]);
DiBag.begin().install(feature).add({ external: () => 1 }).replace('external', () => 2).end();

const frameSource = DiBag.withMetadata(DiBag.fromTokens([token], value => Promise.resolve(value.value)), { owner: 'fixture' as const });
const framed = DiBag.withAcquisitionMetadata(frameSource, () => ({ stage: 'framed' as const }));
const framedBag = DiBag.begin().add({ framed }).bind(token, () => ({ value: 1 }))
  .replace('framed', framed).end();
const framedValue = framedBag.resolve('framed');
const inspection = framedBag.inspect('framed');
type Frames = [Assert<Equal<typeof framedValue, Promise<number>>>,
  Assert<Equal<ProviderGraph<typeof framed>, TokenGraph<readonly [typeof token]>>>,
  Assert<Equal<typeof inspection.metadata, ProviderMetadata<typeof framed>>>,
  Assert<Equal<ProviderAcquisitionMetadata<typeof framed>, readonly [Readonly<{ stage: 'framed' }>]>>];

const numberFactory = () => 2;
DiBag.begin().add({ value: () => 1 }).replace<'value', typeof numberFactory>('value', numberFactory).end();

// Lookup shortcuts must retain opaque errors and the exact invalid-key details,
// including for structurally valid manually annotated builder histories.
type Incremental<E extends Entry, N extends { [K in keyof N]: Registration }> = IncrementalChecked<E, N>;
type Failure<T> = Unsatisfied<'token dependency has an incompatible or opaque contract', { tokens: T }>;
type OpaqueRead = import('../../src').Provider<() => number, {}, readonly [], import('../../src/token-types').OpaqueGraph>;
type OpaqueEntry = { key: 'opaque'; registration: OpaqueRead };
type ReadWider = import('../../src').Provider<() => number, {}, readonly [], TokenGraph<readonly [typeof widerToken]>>;
const widerToken = DiBag.token(key).of<{ value: number } | string>();
type Bound = import('../../src/token-types').Binding<typeof token, () => { value: number }>;
type BoundEntry = { key: typeof key; registration: Bound };
export type CachedTokenBoundaryContracts = [
  Assert<Equal<Incremental<{ key: never; registration: OpaqueRead }, { unrelated: () => number }>, unknown>>,
  Assert<Equal<Incremental<OpaqueEntry, { unrelated: () => number }>, Failure<'opaque token contract'>>>,
  Assert<Equal<Incremental<OpaqueEntry, { opaque: () => number }>, unknown>>,
  Assert<Equal<Incremental<BoundEntry, { read: ReadWider }>, Failure<typeof key>>>,
  Assert<Equal<Incremental<{ key: 'read'; registration: ReadWider }, { [key]: Bound }>, Failure<typeof key>>>,
];

// A string index in a manually annotated history also covers numeric keys.
// Keep the duplicate-key rejection alongside the named-key admission failure.
declare const broadKeys: Builder<{ key: string; registration: () => number }>;
type NumericDuplicateParameter = Parameters<typeof broadKeys.add<{ 1: () => number }>>[0];
type BroadHistoryDuplicate = Assert<Equal<NumericDuplicateParameter, never>>;

// Retained token checks must preserve manual histories and generic empty keys.
export type RetainedTokenShortcutContracts = [
  Assert<Equal<Incremental<{ key: any; registration: ReadWider }, { [key]: Bound }>, Failure<typeof key>>>,
  Assert<Equal<Incremental<{ key: 'read'; registration: ReadWider | OpaqueRead }, { [key]: Bound }>, Failure<'opaque token contract' | typeof key>>>,
];
function bindFromNeverHistory<R extends Registration>(builder: Builder<{ key: never; registration: R }>) {
  return builder.bind(token, () => ({ value: 1 }));
}
