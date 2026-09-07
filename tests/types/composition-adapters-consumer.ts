import { DiBag, type ProviderOutput, type ProviderAcquired } from '../../src';
import { bag, builder, source, fn, native, raw, promisedClass, port, Client } from './composition-adapters';
import type { Assert, Equal } from './assert';
const value = bag.resolve('source'); const result = bag.resolve('fn');
const completed = builder.bind(port, () => 80).end().resolve('source');
export type Exact = [Assert<Equal<typeof value, Client>>, Assert<Equal<typeof completed, Client>>,
  Assert<Equal<typeof result, { port: number; literal: true }>>, Assert<Equal<ProviderOutput<typeof source>, Client>>,
  Assert<Equal<ProviderOutput<typeof fn>, { port: number; literal: true }>>,
  Assert<Equal<ProviderAcquired<typeof native>, { id: number }>>, Assert<Equal<ProviderAcquired<typeof raw>, Promise<{ id: number }>>>,
  Assert<Equal<ProviderAcquired<typeof promisedClass>, number>>];
DiBag.begin().bind(port, () => 1).add({ source }).end();
// @ts-expect-error the inferred declaration must retain its unsatisfied token graph
DiBag.begin().add({ source }).end();
import { inlineDefault, trailingDefault, mixedDefaults } from './composition-adapters';
export type InlineDefaults = [Assert<Equal<ProviderOutput<typeof inlineDefault>, number>>,
  Assert<Equal<ProviderOutput<typeof trailingDefault>, number>>,
  Assert<Equal<ProviderOutput<typeof mixedDefaults>, { selected: number; pending: Promise<number>; value: number }>>];
