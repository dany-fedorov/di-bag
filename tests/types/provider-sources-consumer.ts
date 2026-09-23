import { DiBag } from '../../src';
import type { ProviderAcquiredValue, ProviderOutput } from '../../src';
import { automatic, contextual, explicit, inline, plugin } from './provider-sources';
import type { Assert, Equal } from './assert';

const symbol = Symbol('consumer');
const token = DiBag.createToken(symbol).forService<number>();
const positional = DiBag.createProviderFromFunction({ dependencies: [token], factoryFunction: value => value + 1 });

export type DeclarationContract = [
  Assert<Equal<ProviderOutput<typeof automatic>, Promise<{ id: number }>>>,
  Assert<Equal<ProviderAcquiredValue<typeof automatic>, { id: number }>>,
  Assert<Equal<ProviderOutput<typeof contextual>, { signal: AbortSignal }>>,
  Assert<Equal<ProviderOutput<typeof inline>, { selected: number; maybe: string | undefined; lazy: number; all: readonly number[] }>>,
  Assert<Equal<ProviderOutput<typeof positional>, number>>,
  Assert<Equal<ProviderOutput<typeof explicit>, number>>,
  Assert<Equal<ProviderOutput<typeof plugin>, { run(): void }>>,
  Assert<Equal<typeof token.symbol, typeof symbol>>,
];
