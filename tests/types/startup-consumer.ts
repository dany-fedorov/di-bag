import { contextual, started, lazy, selectedToken, raw, native } from './startup';
import type { ProviderNamedDependencies, ProviderAcquiredValue, ProviderOutput } from '../../src';
import type { Assert, Equal } from './assert';

export type Contracts = [
  Assert<Equal<Awaited<typeof started>, typeof lazy>>,
  Assert<Equal<ProviderNamedDependencies<typeof contextual>, { input: { readonly label: 'exact' } }>>,
  Assert<Equal<ProviderAcquiredValue<typeof raw>, Promise<{ value: 42 }>>>,
  Assert<Equal<ProviderOutput<typeof native>, Promise<{ signal: AbortSignal; value: 1 }>>>,
  Assert<Equal<0 extends (1 & Awaited<typeof started>) ? true : false, false>>,
];
export async function consume() {
  const bag = await started;
  const named = bag.resolve('contextual');
  const value = bag.resolve(selectedToken);
  const owner = bag.inspect('contextual').registrationMetadata.owner;
  const label: 'exact' = named.read();
  const exact: 42 = value.value;
  const exactOwner: 'startup' = owner;
  return { label, exact, exactOwner, child: bag.createScope() };
}
