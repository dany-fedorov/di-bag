import { DiBag } from '../../src';
import { bag, extracted, handler, native, number, raw, selected } from './plugins';
import type { Assert, Equal } from './assert';
import type { ProviderAcquired, ProviderOutput } from '../../src';

const value = bag.resolve(handler);
export type Exact = [
  Assert<Equal<typeof value, { handle(value: string): string }>>,
  Assert<Equal<ProviderOutput<typeof raw>, { handle(value: string): string }>>,
  Assert<Equal<ProviderAcquired<typeof native>, { handle(value: string): string }>>,
  Assert<Equal<ProviderOutput<typeof native>, Promise<{ handle(value: string): string }>>>,
  Assert<Equal<ProviderOutput<typeof extracted>, { handle(value: string): string }>>,
];
DiBag.begin().bind(number, DiBag.factory(() => 1, { acquisition: 'raw' })).add({ extracted }).end();
void selected;
