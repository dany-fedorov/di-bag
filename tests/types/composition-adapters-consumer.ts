import { DiBag, type ProviderOutput, type ProviderAcquiredValue } from '../../src';
import { bag, builder, source, fn, native, raw, promisedClass, port, Client } from './composition-adapters';
import type { Assert, Equal } from './assert';
const value = bag.resolve('source'); const result = bag.resolve('fn');
const completed = builder.register(port, () => 80).build().resolve('source');
export type Exact = [Assert<Equal<typeof value, Client>>, Assert<Equal<typeof completed, Client>>,
  Assert<Equal<typeof result, { port: number; literal: true }>>, Assert<Equal<ProviderOutput<typeof source>, Client>>,
  Assert<Equal<ProviderOutput<typeof fn>, { port: number; literal: true }>>,
  Assert<Equal<ProviderAcquiredValue<typeof native>, { id: number }>>, Assert<Equal<ProviderAcquiredValue<typeof raw>, Promise<{ id: number }>>>,
  Assert<Equal<ProviderAcquiredValue<typeof promisedClass>, number>>];
DiBag.createBuilder().register(port, () => 1).register({ source }).build();
// @ts-expect-error the inferred declaration must retain its unsatisfied token graph
DiBag.createBuilder().register({ source }).build();
import { inlineDefault, trailingDefault, mixedDefaults } from './composition-adapters';
export type InlineDefaults = [Assert<Equal<ProviderOutput<typeof inlineDefault>, number>>,
  Assert<Equal<ProviderOutput<typeof trailingDefault>, number>>,
  Assert<Equal<ProviderOutput<typeof mixedDefaults>, { selected: number; pending: Promise<number>; value: number }>>];
