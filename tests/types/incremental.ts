import {
  DiBag,
  type ProviderAcquisitionMetadata,
  type ProviderMetadata,
  type TokenGraph,
  type ValBoxFrame,
} from '../../src';
import type { ProviderGraph } from '../../src/provider';
import { fromValBox } from '../../src/val-box';
import type { Assert, Equal } from './assert';

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

const frameSource = DiBag.withMetadata(DiBag.fromTokens([token], value => ({
  snapshot: () => ({ value: { present: true as const, value: Promise.resolve(value.value) },
    metadata: { present: true as const, value: { stage: 'framed' as const } }, alias: null }),
})), { owner: 'fixture' as const });
const framed = fromValBox(frameSource);
const framedBag = DiBag.begin().add({ framed }).bind(token, () => ({ value: 1 }))
  .replace('framed', framed).end();
const framedValue = framedBag.resolve('framed');
const inspection = framedBag.inspect('framed');
type Frames = [Assert<Equal<typeof framedValue, Promise<number>>>,
  Assert<Equal<ProviderGraph<typeof framed>, TokenGraph<readonly [typeof token]>>>,
  Assert<Equal<typeof inspection.metadata, ProviderMetadata<typeof framed>>>,
  Assert<Equal<ProviderAcquisitionMetadata<typeof framed>, readonly [ValBoxFrame<{ stage: 'framed' }>]>>];

const numberFactory = () => 2;
DiBag.begin().add({ value: () => 1 }).replace<'value', typeof numberFactory>('value', numberFactory).end();
